package domain

import (
	"errors"
	"testing"
)

func TestCalculateTransactionTotals(t *testing.T) {
	t.Run("menghitung subtotal, pajak PB1 10%, dan grand total secara akurat", func(t *testing.T) {
		items := []CartItemInput{
			{ProductID: 1, ProductName: "Nasi Bakar Ayam Kemangi", UnitPrice: 28000, Quantity: 2}, // 56.000
			{ProductID: 4, ProductName: "Es Kopi Susu Gula Aren", UnitPrice: 22000, Quantity: 1},  // 22.000
		}
		subtotal, tax, grandTotal, err := CalculateTransactionTotals(items, 10.0)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if subtotal != 78000 {
			t.Errorf("expected subtotal 78000, got %.2f", subtotal)
		}
		if tax != 7800 {
			t.Errorf("expected tax 7800, got %.2f", tax)
		}
		if grandTotal != 85800 {
			t.Errorf("expected grandTotal 85800, got %.2f", grandTotal)
		}
	})

	t.Run("menolak keranjang kosong", func(t *testing.T) {
		_, _, _, err := CalculateTransactionTotals(nil, 10.0)
		if !errors.Is(err, ErrEmptyCart) {
			t.Errorf("expected ErrEmptyCart, got %v", err)
		}
	})

	t.Run("menolak qty <= 0", func(t *testing.T) {
		items := []CartItemInput{{ProductID: 1, UnitPrice: 25000, Quantity: 0}}
		_, _, _, err := CalculateTransactionTotals(items, 10.0)
		if !errors.Is(err, ErrInvalidQuantity) {
			t.Errorf("expected ErrInvalidQuantity, got %v", err)
		}
	})
}

func TestCalculatePaymentChange(t *testing.T) {
	t.Run("pembayaran tunai (CASH) dengan uang lebih menghasilkan kembalian tepat", func(t *testing.T) {
		received, change, err := CalculatePaymentChange(85800, 100000, "CASH")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if received != 100000 || change != 14200 {
			t.Errorf("expected received=100000 change=14200, got received=%.2f change=%.2f", received, change)
		}
	})

	t.Run("pembayaran tunai kurang dari grand total menghasilkan error", func(t *testing.T) {
		_, _, err := CalculatePaymentChange(85800, 50000, "CASH")
		if !errors.Is(err, ErrInsufficientPayment) {
			t.Errorf("expected ErrInsufficientPayment, got %v", err)
		}
	})

	t.Run("pembayaran QRIS menyamakan nominal diterima dengan grand total dan kembalian 0", func(t *testing.T) {
		received, change, err := CalculatePaymentChange(85800, 0, "QRIS")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if received != 85800 || change != 0 {
			t.Errorf("expected received=85800 change=0, got received=%.2f change=%.2f", received, change)
		}
	})
}

func TestCalculateBOMDeductionsAndValidation(t *testing.T) {
	recipes := map[int][]RecipeItem{
		1: { // Nasi Bakar: 150g Beras (ID 1), 1 Lembar Daun Pisang (ID 2), 80g Ayam (ID 3)
			{ProductID: 1, RawMaterialID: 1, QuantityRequired: 150},
			{ProductID: 1, RawMaterialID: 2, QuantityRequired: 1},
			{ProductID: 1, RawMaterialID: 3, QuantityRequired: 80},
		},
		3: { // Nasi Goreng: 180g Beras (ID 1), 50g Ayam (ID 3)
			{ProductID: 3, RawMaterialID: 1, QuantityRequired: 180},
			{ProductID: 3, RawMaterialID: 3, QuantityRequired: 50},
		},
	}

	items := []CartItemInput{
		{ProductID: 1, Quantity: 2}, // 300g Beras, 2 Daun Pisang, 160g Ayam
		{ProductID: 3, Quantity: 1}, // 180g Beras, 50g Ayam
	}

	deductions, err := CalculateBOMDeductions(items, recipes)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if deductions[1] != 480 {
		t.Errorf("expected Beras deduction 480g, got %.2f", deductions[1])
	}
	if deductions[2] != 2 {
		t.Errorf("expected Daun Pisang deduction 2 Lembar, got %.2f", deductions[2])
	}
	if deductions[3] != 210 {
		t.Errorf("expected Ayam deduction 210g, got %.2f", deductions[3])
	}

	t.Run("stok cukup berhasil memotong stok bahan baku", func(t *testing.T) {
		currentStock := map[int]RawMaterial{
			1: {ID: 1, Name: "Beras", Unit: "Gram", Stock: 1000},
			2: {ID: 2, Name: "Daun Pisang", Unit: "Lembar", Stock: 10},
			3: {ID: 3, Name: "Ayam Suwir", Unit: "Gram", Stock: 500},
		}
		updated, err := ValidateAndApplyStockDeductions(currentStock, deductions)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if updated[1] != 520 || updated[2] != 8 || updated[3] != 290 {
			t.Errorf("unexpected updated stock map: %+v", updated)
		}
	})

	t.Run("stok kurang mengembalikan InsufficientStockError untuk memicu rollback", func(t *testing.T) {
		currentStock := map[int]RawMaterial{
			1: {ID: 1, Name: "Beras", Unit: "Gram", Stock: 300}, // Kurang! Butuh 480g
			2: {ID: 2, Name: "Daun Pisang", Unit: "Lembar", Stock: 10},
			3: {ID: 3, Name: "Ayam Suwir", Unit: "Gram", Stock: 500},
		}
		_, err := ValidateAndApplyStockDeductions(currentStock, deductions)
		if err == nil {
			t.Fatal("expected error when stock is insufficient, got nil")
		}
		var stockErr *InsufficientStockError
		if !errors.As(err, &stockErr) {
			t.Fatalf("expected *InsufficientStockError, got %T (%v)", err, err)
		}
		if len(stockErr.Details) != 1 || stockErr.Details[0].RawMaterialID != 1 || stockErr.Details[0].Shortage != 180 {
			t.Errorf("unexpected shortage details: %+v", stockErr.Details)
		}
	})
}

func TestCalculateShiftReconciliation(t *testing.T) {
	t.Run("kas fisik sesuai perhitungan sistem (MATCH)", func(t *testing.T) {
		expected, variance, status := CalculateShiftReconciliation(500000, 1250000, 1750000)
		if expected != 1750000 || variance != 0 || status != "MATCH" {
			t.Errorf("expected 1750000/0/MATCH, got %.2f/%.2f/%s", expected, variance, status)
		}
	})

	t.Run("kas fisik kurang dari perhitungan sistem (SHORTAGE)", func(t *testing.T) {
		expected, variance, status := CalculateShiftReconciliation(500000, 1250000, 1700000)
		if expected != 1750000 || variance != -50000 || status != "SHORTAGE" {
			t.Errorf("expected 1750000/-50000/SHORTAGE, got %.2f/%.2f/%s", expected, variance, status)
		}
	})

	t.Run("kas fisik lebih dari perhitungan sistem (OVERAGE)", func(t *testing.T) {
		expected, variance, status := CalculateShiftReconciliation(500000, 1250000, 1765000)
		if expected != 1750000 || variance != 15000 || status != "OVERAGE" {
			t.Errorf("expected 1750000/15000/OVERAGE, got %.2f/%.2f/%s", expected, variance, status)
		}
	})
}
