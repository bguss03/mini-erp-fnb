package store

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"testing"
	"time"

	_ "github.com/lib/pq"
	"mini-erp-fnb/internal/domain"
)

func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/mini_erp_fnb?sslmode=disable"
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		t.Skipf("Skipping integration test: cannot open db: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		t.Skipf("Skipping integration test: PostgreSQL not reachable at %s: %v", dbURL, err)
	}
	return db
}

func TestIntegration_AtomicCheckoutAndMultiRawMaterialDeduction(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()

	st := NewStore(db)
	ctx := context.Background()

	suffix := time.Now().Format("150405.000")
	beras, err := st.CreateRawMaterial(ctx, domain.RawMaterialInput{
		SKU:         "TEST-RM-A-" + suffix,
		Name:        "Test Beras Integrasi " + suffix,
		Unit:        "Gram",
		Stock:       1000,
		MinStock:    200,
		CostPerUnit: 15,
	})
	if err != nil {
		t.Fatalf("failed creating beras: %v", err)
	}
	defer func() { _ = st.DeleteRawMaterial(ctx, beras.ID) }()

	daunPisang, err := st.CreateRawMaterial(ctx, domain.RawMaterialInput{
		SKU:         "TEST-RM-B-" + suffix,
		Name:        "Test Daun Pisang Integrasi " + suffix,
		Unit:        "Lembar",
		Stock:       10,
		MinStock:    3,
		CostPerUnit: 500,
	})
	if err != nil {
		t.Fatalf("failed creating daun pisang: %v", err)
	}
	defer func() { _ = st.DeleteRawMaterial(ctx, daunPisang.ID) }()

	prod, err := st.CreateProduct(ctx, domain.ProductInput{
		SKU:         "TEST-MN-" + suffix,
		Name:        "Test Nasi Bakar Integrasi " + suffix,
		Category:    "Makanan",
		Price:       30000,
		Description: "Menu khusus integration test",
		Recipes: []domain.RecipeItem{
			{RawMaterialID: beras.ID, QuantityRequired: 150},
			{RawMaterialID: daunPisang.ID, QuantityRequired: 1},
		},
	})
	if err != nil {
		t.Fatalf("failed creating product: %v", err)
	}
	defer func() {
		_, _ = db.ExecContext(ctx, `DELETE FROM transactions WHERE id IN (SELECT transaction_id FROM transaction_items WHERE product_id = $1)`, prod.ID)
		_ = st.DeleteProduct(ctx, prod.ID)
	}()

	txResult, err := st.CheckoutTransaction(ctx, domain.CheckoutInput{
		CustomerName:  "Tester Integrasi",
		OrderType:     "DINE_IN",
		PaymentMethod: "CASH",
		CashReceived:  100000,
		Items: []domain.CartItemInput{
			{ProductID: prod.ID, Quantity: 2},
		},
	})
	if err != nil {
		t.Fatalf("expected checkout success, got error: %v", err)
	}

	if txResult.Status != "PAID" {
		t.Errorf("expected transaction status PAID, got %s", txResult.Status)
	}
	if txResult.Subtotal != 60000 || txResult.TaxAmount != 6000 || txResult.GrandTotal != 66000 || txResult.ChangeAmount != 34000 {
		t.Errorf("unexpected totals: subtotal=%.2f tax=%.2f grand=%.2f change=%.2f",
			txResult.Subtotal, txResult.TaxAmount, txResult.GrandTotal, txResult.ChangeAmount)
	}

	materials, err := st.ListRawMaterials(ctx)
	if err != nil {
		t.Fatalf("failed listing raw materials: %v", err)
	}
	var berasAfter, daunAfter float64
	for _, m := range materials {
		if m.ID == beras.ID {
			berasAfter = m.Stock
		}
		if m.ID == daunPisang.ID {
			daunAfter = m.Stock
		}
	}
	if berasAfter != 700 {
		t.Errorf("expected beras stock 700g after checkout, got %.2f", berasAfter)
	}
	if daunAfter != 8 {
		t.Errorf("expected daun pisang stock 8 Lembar after checkout, got %.2f", daunAfter)
	}

	_, err = st.CheckoutTransaction(ctx, domain.CheckoutInput{
		CustomerName:  "Tester Rollback",
		OrderType:     "DINE_IN",
		PaymentMethod: "QRIS",
		Items: []domain.CartItemInput{
			{ProductID: prod.ID, Quantity: 10},
		},
	})
	if err == nil {
		t.Fatal("expected checkout to fail due to insufficient raw material stock, got nil")
	}
	var stockErr *domain.InsufficientStockError
	if !errors.As(err, &stockErr) {
		t.Fatalf("expected *domain.InsufficientStockError, got %T: %v", err, err)
	}

	materialsAfterRollback, err := st.ListRawMaterials(ctx)
	if err != nil {
		t.Fatalf("failed listing raw materials after rollback: %v", err)
	}
	for _, m := range materialsAfterRollback {
		if m.ID == beras.ID && m.Stock != 700 {
			t.Errorf("ACID Rollback failed! Beras stock changed from 700 to %.2f", m.Stock)
		}
		if m.ID == daunPisang.ID && m.Stock != 8 {
			t.Errorf("ACID Rollback failed! Daun Pisang stock changed from 8 to %.2f", m.Stock)
		}
	}
}
