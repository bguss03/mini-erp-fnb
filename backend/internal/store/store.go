package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/lib/pq"
	"mini-erp-fnb/internal/domain"
)

var (
	ErrNotFound          = errors.New("data tidak ditemukan")
	ErrActiveShiftExists = errors.New("masih ada shift kasir yang berstatus OPEN; tutup shift terlebih dahulu")
	ErrShiftAlreadyClose = errors.New("shift ini sudah ditutup")
)

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) DB() *sql.DB {
	return s.db
}

// ============================================================================
// Modul 2: Inventory & Raw Materials CRUD
// ============================================================================

func (s *Store) ListRawMaterials(ctx context.Context) ([]domain.RawMaterial, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, sku, name, unit, stock, min_stock, cost_per_unit, created_at, updated_at
		FROM raw_materials
		ORDER BY id ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var materials []domain.RawMaterial
	for rows.Next() {
		var m domain.RawMaterial
		if err := rows.Scan(
			&m.ID, &m.SKU, &m.Name, &m.Unit,
			&m.Stock, &m.MinStock, &m.CostPerUnit,
			&m.CreatedAt, &m.UpdatedAt,
		); err != nil {
			return nil, err
		}
		m.IsLowStock = domain.IsLowStock(m.Stock, m.MinStock)
		materials = append(materials, m)
	}
	if materials == nil {
		materials = []domain.RawMaterial{}
	}
	return materials, rows.Err()
}

func (s *Store) CreateRawMaterial(ctx context.Context, input domain.RawMaterialInput) (domain.RawMaterial, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.Unit = strings.TrimSpace(input.Unit)
	input.SKU = strings.TrimSpace(input.SKU)
	if input.Name == "" || input.Unit == "" {
		return domain.RawMaterial{}, errors.New("nama dan satuan bahan baku wajib diisi")
	}
	if input.SKU == "" {
		input.SKU = fmt.Sprintf("RM-%d", time.Now().Unix()%100000)
	}

	var m domain.RawMaterial
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO raw_materials (sku, name, unit, stock, min_stock, cost_per_unit)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, sku, name, unit, stock, min_stock, cost_per_unit, created_at, updated_at
	`, input.SKU, input.Name, input.Unit, input.Stock, input.MinStock, input.CostPerUnit).Scan(
		&m.ID, &m.SKU, &m.Name, &m.Unit,
		&m.Stock, &m.MinStock, &m.CostPerUnit,
		&m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return domain.RawMaterial{}, err
	}
	m.IsLowStock = domain.IsLowStock(m.Stock, m.MinStock)
	return m, nil
}

func (s *Store) UpdateRawMaterial(ctx context.Context, id int, input domain.RawMaterialInput) (domain.RawMaterial, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.Unit = strings.TrimSpace(input.Unit)
	if input.Name == "" || input.Unit == "" {
		return domain.RawMaterial{}, errors.New("nama dan satuan bahan baku wajib diisi")
	}

	var m domain.RawMaterial
	err := s.db.QueryRowContext(ctx, `
		UPDATE raw_materials
		SET name = $1,
		    unit = $2,
		    stock = $3,
		    min_stock = $4,
		    cost_per_unit = $5,
		    updated_at = NOW()
		WHERE id = $6
		RETURNING id, sku, name, unit, stock, min_stock, cost_per_unit, created_at, updated_at
	`, input.Name, input.Unit, input.Stock, input.MinStock, input.CostPerUnit, id).Scan(
		&m.ID, &m.SKU, &m.Name, &m.Unit,
		&m.Stock, &m.MinStock, &m.CostPerUnit,
		&m.CreatedAt, &m.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.RawMaterial{}, ErrNotFound
	}
	if err != nil {
		return domain.RawMaterial{}, err
	}
	m.IsLowStock = domain.IsLowStock(m.Stock, m.MinStock)
	return m, nil
}

func (s *Store) AdjustRawMaterialStock(ctx context.Context, id int, adj domain.StockAdjustmentInput) (domain.RawMaterial, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.RawMaterial{}, err
	}
	defer tx.Rollback()

	var m domain.RawMaterial
	err = tx.QueryRowContext(ctx, `
		SELECT id, sku, name, unit, stock, min_stock, cost_per_unit, created_at, updated_at
		FROM raw_materials
		WHERE id = $1
		FOR UPDATE
	`, id).Scan(
		&m.ID, &m.SKU, &m.Name, &m.Unit,
		&m.Stock, &m.MinStock, &m.CostPerUnit,
		&m.CreatedAt, &m.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.RawMaterial{}, ErrNotFound
	}
	if err != nil {
		return domain.RawMaterial{}, err
	}

	stockBefore := m.Stock
	stockAfter := domain.RoundCurrency(stockBefore + adj.QuantityChange)
	if stockAfter < 0 {
		return domain.RawMaterial{}, errors.New("stok akhir bahan baku tidak boleh negatif")
	}

	movementType := adj.MovementType
	if movementType != "RESTOCK" && movementType != "ADJUSTMENT" {
		movementType = "RESTOCK"
	}

	err = tx.QueryRowContext(ctx, `
		UPDATE raw_materials
		SET stock = $1, updated_at = NOW()
		WHERE id = $2
		RETURNING stock, updated_at
	`, stockAfter, id).Scan(&m.Stock, &m.UpdatedAt)
	if err != nil {
		return domain.RawMaterial{}, err
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO stock_movements (raw_material_id, movement_type, quantity_change, stock_before, stock_after, notes)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, id, movementType, adj.QuantityChange, stockBefore, stockAfter, adj.Notes)
	if err != nil {
		return domain.RawMaterial{}, err
	}

	if err := tx.Commit(); err != nil {
		return domain.RawMaterial{}, err
	}
	m.IsLowStock = domain.IsLowStock(m.Stock, m.MinStock)
	return m, nil
}

func (s *Store) DeleteRawMaterial(ctx context.Context, id int) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM raw_materials WHERE id = $1`, id)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) ListStockMovements(ctx context.Context, limit int) ([]domain.StockMovement, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT sm.id, sm.raw_material_id, rm.name, rm.unit, sm.transaction_id,
		       sm.movement_type, sm.quantity_change, sm.stock_before, sm.stock_after, sm.notes, sm.created_at
		FROM stock_movements sm
		JOIN raw_materials rm ON rm.id = sm.raw_material_id
		ORDER BY sm.created_at DESC, sm.id DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var movements []domain.StockMovement
	for rows.Next() {
		var mv domain.StockMovement
		var txID sql.NullInt64
		if err := rows.Scan(
			&mv.ID, &mv.RawMaterialID, &mv.RawMaterialName, &mv.Unit, &txID,
			&mv.MovementType, &mv.QuantityChange, &mv.StockBefore, &mv.StockAfter, &mv.Notes, &mv.CreatedAt,
		); err != nil {
			return nil, err
		}
		if txID.Valid {
			val := int(txID.Int64)
			mv.TransactionID = &val
		}
		movements = append(movements, mv)
	}
	if movements == nil {
		movements = []domain.StockMovement{}
	}
	return movements, rows.Err()
}

// ============================================================================
// Modul 1 & 2: Products (Menu) & Recipe Linkage (BOM)
// ============================================================================

func (s *Store) ListProducts(ctx context.Context) ([]domain.Product, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, sku, name, category, price, description, image_url, is_active, created_at, updated_at
		FROM products
		ORDER BY id ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []domain.Product
	productIndex := make(map[int]int)
	for rows.Next() {
		var p domain.Product
		if err := rows.Scan(
			&p.ID, &p.SKU, &p.Name, &p.Category, &p.Price,
			&p.Description, &p.ImageURL, &p.IsActive, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		p.Recipes = []domain.RecipeItem{}
		productIndex[p.ID] = len(products)
		products = append(products, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(products) == 0 {
		return []domain.Product{}, nil
	}

	recipeRows, err := s.db.QueryContext(ctx, `
		SELECT pr.id, pr.product_id, pr.raw_material_id, rm.sku, rm.name, rm.unit, rm.stock, pr.quantity_required
		FROM product_recipes pr
		JOIN raw_materials rm ON rm.id = pr.raw_material_id
		ORDER BY pr.product_id ASC, pr.id ASC
	`)
	if err != nil {
		return nil, err
	}
	defer recipeRows.Close()

	for recipeRows.Next() {
		var r domain.RecipeItem
		if err := recipeRows.Scan(
			&r.ID, &r.ProductID, &r.RawMaterialID,
			&r.RawMaterialSKU, &r.RawMaterialName, &r.RawMaterialUnit,
			&r.AvailableStock, &r.QuantityRequired,
		); err != nil {
			return nil, err
		}
		if idx, ok := productIndex[r.ProductID]; ok {
			products[idx].Recipes = append(products[idx].Recipes, r)
		}
	}

	for i := range products {
		products[i].MaxPortions = domain.CalculateMaxPortions(products[i].Recipes)
	}

	return products, recipeRows.Err()
}

func (s *Store) GetProductByID(ctx context.Context, id int) (domain.Product, error) {
	products, err := s.ListProducts(ctx)
	if err != nil {
		return domain.Product{}, err
	}
	for _, p := range products {
		if p.ID == id {
			return p, nil
		}
	}
	return domain.Product{}, ErrNotFound
}

func (s *Store) CreateProduct(ctx context.Context, input domain.ProductInput) (domain.Product, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.Category = strings.TrimSpace(input.Category)
	input.SKU = strings.TrimSpace(input.SKU)
	if input.Name == "" {
		return domain.Product{}, errors.New("nama menu wajib diisi")
	}
	if input.Category == "" {
		input.Category = "Makanan"
	}
	if input.SKU == "" {
		input.SKU = fmt.Sprintf("MN-%d", time.Now().Unix()%100000)
	}
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Product{}, err
	}
	defer tx.Rollback()

	var productID int
	err = tx.QueryRowContext(ctx, `
		INSERT INTO products (sku, name, category, price, description, image_url, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, input.SKU, input.Name, input.Category, input.Price, input.Description, input.ImageURL, isActive).Scan(&productID)
	if err != nil {
		return domain.Product{}, err
	}

	for _, r := range input.Recipes {
		if r.RawMaterialID <= 0 || r.QuantityRequired <= 0 {
			continue
		}
		_, err := tx.ExecContext(ctx, `
			INSERT INTO product_recipes (product_id, raw_material_id, quantity_required)
			VALUES ($1, $2, $3)
			ON CONFLICT (product_id, raw_material_id)
			DO UPDATE SET quantity_required = EXCLUDED.quantity_required
		`, productID, r.RawMaterialID, r.QuantityRequired)
		if err != nil {
			return domain.Product{}, err
		}
	}

	if err := tx.Commit(); err != nil {
		return domain.Product{}, err
	}

	return s.GetProductByID(ctx, productID)
}

func (s *Store) UpdateProduct(ctx context.Context, id int, input domain.ProductInput) (domain.Product, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.Category = strings.TrimSpace(input.Category)
	if input.Name == "" {
		return domain.Product{}, errors.New("nama menu wajib diisi")
	}
	if input.Category == "" {
		input.Category = "Makanan"
	}
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Product{}, err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx, `
		UPDATE products
		SET name = $1,
		    category = $2,
		    price = $3,
		    description = $4,
		    image_url = $5,
		    is_active = $6,
		    updated_at = NOW()
		WHERE id = $7
	`, input.Name, input.Category, input.Price, input.Description, input.ImageURL, isActive, id)
	if err != nil {
		return domain.Product{}, err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return domain.Product{}, ErrNotFound
	}

	if input.Recipes != nil {
		if _, err := tx.ExecContext(ctx, `DELETE FROM product_recipes WHERE product_id = $1`, id); err != nil {
			return domain.Product{}, err
		}
		for _, r := range input.Recipes {
			if r.RawMaterialID <= 0 || r.QuantityRequired <= 0 {
				continue
			}
			_, err := tx.ExecContext(ctx, `
				INSERT INTO product_recipes (product_id, raw_material_id, quantity_required)
				VALUES ($1, $2, $3)
			`, id, r.RawMaterialID, r.QuantityRequired)
			if err != nil {
				return domain.Product{}, err
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return domain.Product{}, err
	}
	return s.GetProductByID(ctx, id)
}

func (s *Store) DeleteProduct(ctx context.Context, id int) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM products WHERE id = $1`, id)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

// ============================================================================
// Modul 1 & 2: Atomic POS Checkout & Automated BOM Stock Deduction (ACID)
// ============================================================================

func (s *Store) CheckoutTransaction(ctx context.Context, input domain.CheckoutInput) (domain.Transaction, error) {
	if len(input.Items) == 0 {
		return domain.Transaction{}, domain.ErrEmptyCart
	}

	taxRate := 10.0 // Default PB1 10%
	if input.TaxRate != nil {
		taxRate = *input.TaxRate
	}
	paymentMethod := strings.ToUpper(strings.TrimSpace(input.PaymentMethod))
	if paymentMethod == "" {
		paymentMethod = "CASH"
	}
	orderType := strings.ToUpper(strings.TrimSpace(input.OrderType))
	if orderType != "DINE_IN" && orderType != "TAKE_AWAY" {
		orderType = "DINE_IN"
	}
	customerName := strings.TrimSpace(input.CustomerName)
	if customerName == "" {
		customerName = "Pelanggan Umum"
	}

	// Mulai Database Transaction (ACID Compliance)
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Transaction{}, err
	}
	defer tx.Rollback()

	// 1. Cari Shift Aktif jika ShiftID tidak dikirim eksplisit
	var activeShiftID *int
	if input.ShiftID != nil && *input.ShiftID > 0 {
		activeShiftID = input.ShiftID
	} else {
		var sID int
		err := tx.QueryRowContext(ctx, `SELECT id FROM shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1 FOR UPDATE`).Scan(&sID)
		if err == nil {
			activeShiftID = &sID
		} else if !errors.Is(err, sql.ErrNoRows) {
			return domain.Transaction{}, err
		}
	}

	// 2. Ambil data Produk & Resep BOM untuk produk yang dipesan
	productIDs := make([]int, 0, len(input.Items))
	seenProd := make(map[int]bool)
	for _, it := range input.Items {
		if it.Quantity <= 0 {
			return domain.Transaction{}, domain.ErrInvalidQuantity
		}
		if !seenProd[it.ProductID] {
			seenProd[it.ProductID] = true
			productIDs = append(productIDs, it.ProductID)
		}
	}
	sort.Ints(productIDs)

	prodRows, err := tx.QueryContext(ctx, `
		SELECT id, name, price
		FROM products
		WHERE id = ANY($1) AND is_active = TRUE
	`, pq.Array(productIDs))
	if err != nil {
		return domain.Transaction{}, err
	}
	productMap := make(map[int]struct {
		Name  string
		Price float64
	})
	for prodRows.Next() {
		var id int
		var name string
		var price float64
		if err := prodRows.Scan(&id, &name, &price); err != nil {
			prodRows.Close()
			return domain.Transaction{}, err
		}
		productMap[id] = struct {
			Name  string
			Price float64
		}{Name: name, Price: price}
	}
	prodRows.Close()

	// Lengkapi harga dan nama produk dari database agar tidak bisa dimanipulasi dari client
	enrichedItems := make([]domain.CartItemInput, len(input.Items))
	for i, item := range input.Items {
		prod, ok := productMap[item.ProductID]
		if !ok {
			return domain.Transaction{}, fmt.Errorf("produk ID %d tidak ditemukan atau tidak aktif", item.ProductID)
		}
		enrichedItems[i] = domain.CartItemInput{
			ProductID:   item.ProductID,
			ProductName: prod.Name,
			UnitPrice:   prod.Price,
			Quantity:    item.Quantity,
		}
	}

	// 3. Kalkulasi Subtotal, Tax (PB1 10%), dan Grand Total
	subtotal, taxAmount, grandTotal, err := domain.CalculateTransactionTotals(enrichedItems, taxRate)
	if err != nil {
		return domain.Transaction{}, err
	}

	// 4. Validasi pembayaran dan hitung kembalian
	cashReceived, changeAmount, err := domain.CalculatePaymentChange(grandTotal, input.CashReceived, paymentMethod)
	if err != nil {
		return domain.Transaction{}, err
	}

	// 5. Ambil resep BOM untuk produk-produk di keranjang
	recipeRows, err := tx.QueryContext(ctx, `
		SELECT product_id, raw_material_id, quantity_required
		FROM product_recipes
		WHERE product_id = ANY($1)
	`, pq.Array(productIDs))
	if err != nil {
		return domain.Transaction{}, err
	}
	recipesByProduct := make(map[int][]domain.RecipeItem)
	for recipeRows.Next() {
		var r domain.RecipeItem
		if err := recipeRows.Scan(&r.ProductID, &r.RawMaterialID, &r.QuantityRequired); err != nil {
			recipeRows.Close()
			return domain.Transaction{}, err
		}
		recipesByProduct[r.ProductID] = append(recipesByProduct[r.ProductID], r)
	}
	recipeRows.Close()

	// 6. Hitung total kebutuhan tiap bahan baku dan kunci baris raw_materials dengan SELECT ... FOR UPDATE
	requiredDeductions, err := domain.CalculateBOMDeductions(enrichedItems, recipesByProduct)
	if err != nil {
		return domain.Transaction{}, err
	}

	rawIDs := make([]int, 0, len(requiredDeductions))
	for rawID := range requiredDeductions {
		rawIDs = append(rawIDs, rawID)
	}
	sort.Ints(rawIDs)

	currentMaterials := make(map[int]domain.RawMaterial, len(rawIDs))
	if len(rawIDs) > 0 {
		matRows, err := tx.QueryContext(ctx, `
			SELECT id, sku, name, unit, stock, min_stock
			FROM raw_materials
			WHERE id = ANY($1)
			ORDER BY id ASC
			FOR UPDATE
		`, pq.Array(rawIDs))
		if err != nil {
			return domain.Transaction{}, err
		}
		for matRows.Next() {
			var m domain.RawMaterial
			if err := matRows.Scan(&m.ID, &m.SKU, &m.Name, &m.Unit, &m.Stock, &m.MinStock); err != nil {
				matRows.Close()
				return domain.Transaction{}, err
			}
			currentMaterials[m.ID] = m
		}
		matRows.Close()
	}

	// 7. Validasi ketersediaan stok bahan baku; jika ada yang kurang -> return error & otomatis Rollback!
	updatedStocks, err := domain.ValidateAndApplyStockDeductions(currentMaterials, requiredDeductions)
	if err != nil {
		return domain.Transaction{}, err
	}

	// 8. Simpan header transaksi dengan status PAID
	invoiceNumber := fmt.Sprintf("INV-%s-%04d", time.Now().Format("20060102-150405"), time.Now().Nanosecond()%10000)
	var createdTx domain.Transaction
	err = tx.QueryRowContext(ctx, `
		INSERT INTO transactions (
			invoice_number, shift_id, customer_name, order_type,
			subtotal, tax_rate, tax_amount, grand_total,
			payment_method, cash_received, change_amount, status
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PAID')
		RETURNING id, invoice_number, shift_id, customer_name, order_type,
		          subtotal, tax_rate, tax_amount, grand_total,
		          payment_method, cash_received, change_amount, status, created_at
	`,
		invoiceNumber, activeShiftID, customerName, orderType,
		subtotal, taxRate, taxAmount, grandTotal,
		paymentMethod, cashReceived, changeAmount,
	).Scan(
		&createdTx.ID, &createdTx.InvoiceNumber, &createdTx.ShiftID, &createdTx.CustomerName, &createdTx.OrderType,
		&createdTx.Subtotal, &createdTx.TaxRate, &createdTx.TaxAmount, &createdTx.GrandTotal,
		&createdTx.PaymentMethod, &createdTx.CashReceived, &createdTx.ChangeAmount, &createdTx.Status, &createdTx.CreatedAt,
	)
	if err != nil {
		return domain.Transaction{}, err
	}

	// 9. Simpan item-item transaksi
	createdTx.Items = make([]domain.TransactionItem, 0, len(enrichedItems))
	for _, item := range enrichedItems {
		itemSubtotal := domain.RoundCurrency(item.UnitPrice * float64(item.Quantity))
		var ti domain.TransactionItem
		err := tx.QueryRowContext(ctx, `
			INSERT INTO transaction_items (transaction_id, product_id, product_name, unit_price, quantity, subtotal)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id, transaction_id, product_id, product_name, unit_price, quantity, subtotal
		`, createdTx.ID, item.ProductID, item.ProductName, item.UnitPrice, item.Quantity, itemSubtotal).Scan(
			&ti.ID, &ti.TransactionID, &ti.ProductID, &ti.ProductName, &ti.UnitPrice, &ti.Quantity, &ti.Subtotal,
		)
		if err != nil {
			return domain.Transaction{}, err
		}
		createdTx.Items = append(createdTx.Items, ti)
	}

	// 10. Potong stok bahan baku secara atomik & catat stock_movements
	createdTx.StockDeductions = make([]domain.StockDeductionSummary, 0, len(rawIDs))
	for _, rawID := range rawIDs {
		deductedQty := requiredDeductions[rawID]
		mat := currentMaterials[rawID]
		stockAfter := updatedStocks[rawID]

		_, err := tx.ExecContext(ctx, `
			UPDATE raw_materials
			SET stock = $1, updated_at = NOW()
			WHERE id = $2
		`, stockAfter, rawID)
		if err != nil {
			return domain.Transaction{}, err
		}

		_, err = tx.ExecContext(ctx, `
			INSERT INTO stock_movements (raw_material_id, transaction_id, movement_type, quantity_change, stock_before, stock_after, notes)
			VALUES ($1, $2, 'SALE_DEDUCTION', $3, $4, $5, $6)
		`, rawID, createdTx.ID, -deductedQty, mat.Stock, stockAfter, fmt.Sprintf("Deduksi otomatis transaksi %s", createdTx.InvoiceNumber))
		if err != nil {
			return domain.Transaction{}, err
		}

		createdTx.StockDeductions = append(createdTx.StockDeductions, domain.StockDeductionSummary{
			RawMaterialID:   rawID,
			RawMaterialName: mat.Name,
			Unit:            mat.Unit,
			DeductedQty:     deductedQty,
			StockBefore:     mat.Stock,
			StockAfter:      stockAfter,
			IsLowStock:      domain.IsLowStock(stockAfter, mat.MinStock),
		})
	}

	// 11. Jika pembayaran CASH dan ada shift aktif, perbarui total penjualan tunai & expected cash pada shift tersebut
	if activeShiftID != nil && paymentMethod == "CASH" {
		_, err := tx.ExecContext(ctx, `
			UPDATE shifts
			SET total_cash_sales = total_cash_sales + $1,
			    expected_cash = opening_cash + total_cash_sales + $1
			WHERE id = $2 AND status = 'OPEN'
		`, grandTotal, *activeShiftID)
		if err != nil {
			return domain.Transaction{}, err
		}
	}

	// 12. Commit seluruh transaksi database
	if err := tx.Commit(); err != nil {
		return domain.Transaction{}, err
	}

	return createdTx, nil
}

func (s *Store) ListTransactions(ctx context.Context, limit int) ([]domain.Transaction, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, invoice_number, shift_id, customer_name, order_type,
		       subtotal, tax_rate, tax_amount, grand_total,
		       payment_method, cash_received, change_amount, status, created_at
		FROM transactions
		ORDER BY created_at DESC, id DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var txs []domain.Transaction
	txIndex := make(map[int]int)
	txIDs := make([]int, 0)
	for rows.Next() {
		var t domain.Transaction
		var shiftID sql.NullInt64
		if err := rows.Scan(
			&t.ID, &t.InvoiceNumber, &shiftID, &t.CustomerName, &t.OrderType,
			&t.Subtotal, &t.TaxRate, &t.TaxAmount, &t.GrandTotal,
			&t.PaymentMethod, &t.CashReceived, &t.ChangeAmount, &t.Status, &t.CreatedAt,
		); err != nil {
			return nil, err
		}
		if shiftID.Valid {
			val := int(shiftID.Int64)
			t.ShiftID = &val
		}
		t.Items = []domain.TransactionItem{}
		txIndex[t.ID] = len(txs)
		txIDs = append(txIDs, t.ID)
		txs = append(txs, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(txs) == 0 {
		return []domain.Transaction{}, nil
	}

	itemRows, err := s.db.QueryContext(ctx, `
		SELECT id, transaction_id, product_id, product_name, unit_price, quantity, subtotal
		FROM transaction_items
		WHERE transaction_id = ANY($1)
		ORDER BY id ASC
	`, pq.Array(txIDs))
	if err != nil {
		return nil, err
	}
	defer itemRows.Close()

	for itemRows.Next() {
		var ti domain.TransactionItem
		if err := itemRows.Scan(
			&ti.ID, &ti.TransactionID, &ti.ProductID, &ti.ProductName, &ti.UnitPrice, &ti.Quantity, &ti.Subtotal,
		); err != nil {
			return nil, err
		}
		if idx, ok := txIndex[ti.TransactionID]; ok {
			txs[idx].Items = append(txs[idx].Items, ti)
		}
	}

	return txs, itemRows.Err()
}

// ============================================================================
// Modul 3: HR & Cash Management (Rekonsiliasi Shift Kasir)
// ============================================================================

func (s *Store) enrichShiftStats(ctx context.Context, sh *domain.Shift) error {
	var nonCash float64
	var txCount int
	err := s.db.QueryRowContext(ctx, `
		SELECT
			COALESCE(SUM(CASE WHEN payment_method <> 'CASH' THEN grand_total ELSE 0 END), 0),
			COUNT(*)
		FROM transactions
		WHERE shift_id = $1 AND status = 'PAID'
	`, sh.ID).Scan(&nonCash, &txCount)
	if err != nil {
		return err
	}
	sh.TotalNonCash = nonCash
	sh.TransactionCount = txCount

	if sh.Status == "OPEN" {
		sh.DiscrepancyType = "OPEN"
		sh.ExpectedCash = domain.RoundCurrency(sh.OpeningCash + sh.TotalCashSales)
	} else if sh.ActualCash != nil {
		_, _, dtype := domain.CalculateShiftReconciliation(sh.OpeningCash, sh.TotalCashSales, *sh.ActualCash)
		sh.DiscrepancyType = dtype
	}
	return nil
}

func (s *Store) GetActiveShift(ctx context.Context) (*domain.Shift, error) {
	var sh domain.Shift
	var actualCash, variance sql.NullFloat64
	var closedAt sql.NullTime

	err := s.db.QueryRowContext(ctx, `
		SELECT id, cashier_name, opening_cash, total_cash_sales, expected_cash,
		       actual_cash, variance, notes, status, opened_at, closed_at
		FROM shifts
		WHERE status = 'OPEN'
		ORDER BY id DESC
		LIMIT 1
	`).Scan(
		&sh.ID, &sh.CashierName, &sh.OpeningCash, &sh.TotalCashSales, &sh.ExpectedCash,
		&actualCash, &variance, &sh.Notes, &sh.Status, &sh.OpenedAt, &closedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if actualCash.Valid {
		v := actualCash.Float64
		sh.ActualCash = &v
	}
	if variance.Valid {
		v := variance.Float64
		sh.Variance = &v
	}
	if closedAt.Valid {
		t := closedAt.Time
		sh.ClosedAt = &t
	}
	if err := s.enrichShiftStats(ctx, &sh); err != nil {
		return nil, err
	}
	return &sh, nil
}

func (s *Store) ListShifts(ctx context.Context, limit int) ([]domain.Shift, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, cashier_name, opening_cash, total_cash_sales, expected_cash,
		       actual_cash, variance, notes, status, opened_at, closed_at
		FROM shifts
		ORDER BY id DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var shifts []domain.Shift
	for rows.Next() {
		var sh domain.Shift
		var actualCash, variance sql.NullFloat64
		var closedAt sql.NullTime
		if err := rows.Scan(
			&sh.ID, &sh.CashierName, &sh.OpeningCash, &sh.TotalCashSales, &sh.ExpectedCash,
			&actualCash, &variance, &sh.Notes, &sh.Status, &sh.OpenedAt, &closedAt,
		); err != nil {
			return nil, err
		}
		if actualCash.Valid {
			v := actualCash.Float64
			sh.ActualCash = &v
		}
		if variance.Valid {
			v := variance.Float64
			sh.Variance = &v
		}
		if closedAt.Valid {
			t := closedAt.Time
			sh.ClosedAt = &t
		}
		_ = s.enrichShiftStats(ctx, &sh)
		shifts = append(shifts, sh)
	}
	if shifts == nil {
		shifts = []domain.Shift{}
	}
	return shifts, rows.Err()
}

// OpenShift (Clock-in Shift / Buka Kasir) mencatat Saldo Awal Kasir
func (s *Store) OpenShift(ctx context.Context, input domain.OpenShiftInput) (domain.Shift, error) {
	input.CashierName = strings.TrimSpace(input.CashierName)
	if input.CashierName == "" {
		return domain.Shift{}, errors.New("nama kasir wajib diisi")
	}
	if input.OpeningCash < 0 {
		return domain.Shift{}, errors.New("saldo awal kasir tidak boleh negatif")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Shift{}, err
	}
	defer tx.Rollback()

	var existingID int
	err = tx.QueryRowContext(ctx, `SELECT id FROM shifts WHERE status = 'OPEN' LIMIT 1 FOR UPDATE`).Scan(&existingID)
	if err == nil {
		return domain.Shift{}, ErrActiveShiftExists
	} else if !errors.Is(err, sql.ErrNoRows) {
		return domain.Shift{}, err
	}

	var sh domain.Shift
	err = tx.QueryRowContext(ctx, `
		INSERT INTO shifts (cashier_name, opening_cash, total_cash_sales, expected_cash, notes, status)
		VALUES ($1, $2, 0, $2, $3, 'OPEN')
		RETURNING id, cashier_name, opening_cash, total_cash_sales, expected_cash, notes, status, opened_at
	`, input.CashierName, input.OpeningCash, input.Notes).Scan(
		&sh.ID, &sh.CashierName, &sh.OpeningCash, &sh.TotalCashSales, &sh.ExpectedCash, &sh.Notes, &sh.Status, &sh.OpenedAt,
	)
	if err != nil {
		return domain.Shift{}, err
	}

	if err := tx.Commit(); err != nil {
		return domain.Shift{}, err
	}
	sh.DiscrepancyType = "OPEN"
	return sh, nil
}

// CloseShift (Clock-out Shift / Tutup Kasir) menghitung Expected Cash dan mencatat Variance terhadap Actual Cash
func (s *Store) CloseShift(ctx context.Context, shiftID int, input domain.CloseShiftInput) (domain.Shift, error) {
	if input.ActualCash < 0 {
		return domain.Shift{}, errors.New("hitungan uang fisik tidak boleh negatif")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Shift{}, err
	}
	defer tx.Rollback()

	var sh domain.Shift
	err = tx.QueryRowContext(ctx, `
		SELECT id, cashier_name, opening_cash, total_cash_sales, status, opened_at, notes
		FROM shifts
		WHERE id = $1
		FOR UPDATE
	`, shiftID).Scan(
		&sh.ID, &sh.CashierName, &sh.OpeningCash, &sh.TotalCashSales, &sh.Status, &sh.OpenedAt, &sh.Notes,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Shift{}, ErrNotFound
	}
	if err != nil {
		return domain.Shift{}, err
	}
	if sh.Status == "CLOSED" {
		return domain.Shift{}, ErrShiftAlreadyClose
	}

	// Hitung ulang total penjualan tunai dari tabel transactions pada shift ini untuk akurasi 100%
	var verifiedCashSales float64
	err = tx.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(grand_total), 0)
		FROM transactions
		WHERE shift_id = $1 AND status = 'PAID' AND payment_method = 'CASH'
	`, shiftID).Scan(&verifiedCashSales)
	if err != nil {
		return domain.Shift{}, err
	}

	expectedCash, variance, discrepancyType := domain.CalculateShiftReconciliation(
		sh.OpeningCash, verifiedCashSales, input.ActualCash,
	)

	notes := strings.TrimSpace(input.Notes)
	if notes == "" {
		notes = sh.Notes
	}

	var closedAt time.Time
	err = tx.QueryRowContext(ctx, `
		UPDATE shifts
		SET total_cash_sales = $1,
		    expected_cash = $2,
		    actual_cash = $3,
		    variance = $4,
		    notes = $5,
		    status = 'CLOSED',
		    closed_at = NOW()
		WHERE id = $6
		RETURNING closed_at
	`, verifiedCashSales, expectedCash, input.ActualCash, variance, notes, shiftID).Scan(&closedAt)
	if err != nil {
		return domain.Shift{}, err
	}

	if err := tx.Commit(); err != nil {
		return domain.Shift{}, err
	}

	sh.TotalCashSales = verifiedCashSales
	sh.ExpectedCash = expectedCash
	actualCopy := domain.RoundCurrency(input.ActualCash)
	varianceCopy := variance
	sh.ActualCash = &actualCopy
	sh.Variance = &varianceCopy
	sh.DiscrepancyType = discrepancyType
	sh.Notes = notes
	sh.Status = "CLOSED"
	sh.ClosedAt = &closedAt
	_ = s.enrichShiftStats(ctx, &sh)

	return sh, nil
}

func (s *Store) GetDashboardSummary(ctx context.Context) (domain.DashboardSummary, error) {
	var summary domain.DashboardSummary

	err := s.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(grand_total), 0), COUNT(*)
		FROM transactions
		WHERE status = 'PAID' AND created_at >= CURRENT_DATE
	`).Scan(&summary.TodayRevenue, &summary.TodayOrders)
	if err != nil {
		return summary, err
	}

	materials, err := s.ListRawMaterials(ctx)
	if err != nil {
		return summary, err
	}
	summary.LowStockMaterials = []domain.RawMaterial{}
	for _, m := range materials {
		if m.IsLowStock {
			summary.LowStockMaterials = append(summary.LowStockMaterials, m)
		}
	}
	summary.LowStockCount = len(summary.LowStockMaterials)

	activeShift, err := s.GetActiveShift(ctx)
	if err != nil {
		return summary, err
	}
	summary.ActiveShift = activeShift

	recentTxs, err := s.ListTransactions(ctx, 10)
	if err != nil {
		return summary, err
	}
	summary.RecentTransactions = recentTxs

	return summary, nil
}
