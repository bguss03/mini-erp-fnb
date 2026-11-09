package domain

import "time"

// RawMaterial merepresentasikan stok fisik bahan baku di dapur (Modul 2)
type RawMaterial struct {
	ID          int       `json:"id"`
	SKU         string    `json:"sku"`
	Name        string    `json:"name"`
	Unit        string    `json:"unit"`
	Stock       float64   `json:"stock"`
	MinStock    float64   `json:"min_stock"`
	CostPerUnit float64   `json:"cost_per_unit"`
	IsLowStock  bool      `json:"is_low_stock"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type RawMaterialInput struct {
	SKU         string  `json:"sku"`
	Name        string  `json:"name"`
	Unit        string  `json:"unit"`
	Stock       float64 `json:"stock"`
	MinStock    float64 `json:"min_stock"`
	CostPerUnit float64 `json:"cost_per_unit"`
}

type StockAdjustmentInput struct {
	QuantityChange float64 `json:"quantity_change"`
	MovementType   string  `json:"movement_type"` // RESTOCK atau ADJUSTMENT
	Notes          string  `json:"notes"`
}

// RecipeItem merepresentasikan 1 komponen bahan baku dalam resep menu (BOM)
type RecipeItem struct {
	ID               int     `json:"id,omitempty"`
	ProductID        int     `json:"product_id,omitempty"`
	RawMaterialID    int     `json:"raw_material_id"`
	RawMaterialSKU   string  `json:"raw_material_sku,omitempty"`
	RawMaterialName  string  `json:"raw_material_name,omitempty"`
	RawMaterialUnit  string  `json:"raw_material_unit,omitempty"`
	AvailableStock   float64 `json:"available_stock,omitempty"`
	QuantityRequired float64 `json:"quantity_required"`
}

// Product merepresentasikan menu F&B beserta daftar resepnya (Modul 1 & 2)
type Product struct {
	ID          int          `json:"id"`
	SKU         string       `json:"sku"`
	Name        string       `json:"name"`
	Category    string       `json:"category"`
	Price       float64      `json:"price"`
	Description string       `json:"description"`
	ImageURL    string       `json:"image_url"`
	IsActive    bool         `json:"is_active"`
	MaxPortions int          `json:"max_portions"`
	Recipes     []RecipeItem `json:"recipes"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

type ProductInput struct {
	SKU         string       `json:"sku"`
	Name        string       `json:"name"`
	Category    string       `json:"category"`
	Price       float64      `json:"price"`
	Description string       `json:"description"`
	ImageURL    string       `json:"image_url"`
	IsActive    *bool        `json:"is_active,omitempty"`
	Recipes     []RecipeItem `json:"recipes"`
}

// CartItemInput merepresentasikan item dalam keranjang pesanan saat checkout
type CartItemInput struct {
	ProductID   int     `json:"product_id"`
	ProductName string  `json:"product_name,omitempty"`
	UnitPrice   float64 `json:"unit_price,omitempty"`
	Quantity    int     `json:"quantity"`
}

// CheckoutInput merepresentasikan payload request checkout POS (Modul 1)
type CheckoutInput struct {
	ShiftID       *int            `json:"shift_id,omitempty"`
	CustomerName  string          `json:"customer_name"`
	OrderType     string          `json:"order_type"`     // DINE_IN, TAKE_AWAY
	PaymentMethod string          `json:"payment_method"` // CASH, QRIS, DEBIT
	CashReceived  float64         `json:"cash_received"`
	TaxRate       *float64        `json:"tax_rate,omitempty"` // Default 10% (PB1)
	Items         []CartItemInput `json:"items"`
}

type TransactionItem struct {
	ID            int     `json:"id"`
	TransactionID int     `json:"transaction_id"`
	ProductID     int     `json:"product_id"`
	ProductName   string  `json:"product_name"`
	UnitPrice     float64 `json:"unit_price"`
	Quantity      int     `json:"quantity"`
	Subtotal      float64 `json:"subtotal"`
}

type StockDeductionSummary struct {
	RawMaterialID   int     `json:"raw_material_id"`
	RawMaterialName string  `json:"raw_material_name"`
	Unit            string  `json:"unit"`
	DeductedQty     float64 `json:"deducted_qty"`
	StockBefore     float64 `json:"stock_before"`
	StockAfter      float64 `json:"stock_after"`
	IsLowStock      bool    `json:"is_low_stock"`
}

type Transaction struct {
	ID              int                     `json:"id"`
	InvoiceNumber   string                  `json:"invoice_number"`
	ShiftID         *int                    `json:"shift_id,omitempty"`
	CustomerName    string                  `json:"customer_name"`
	OrderType       string                  `json:"order_type"`
	Subtotal        float64                 `json:"subtotal"`
	TaxRate         float64                 `json:"tax_rate"`
	TaxAmount       float64                 `json:"tax_amount"`
	GrandTotal      float64                 `json:"grand_total"`
	PaymentMethod   string                  `json:"payment_method"`
	CashReceived    float64                 `json:"cash_received"`
	ChangeAmount    float64                 `json:"change_amount"`
	Status          string                  `json:"status"`
	Items           []TransactionItem       `json:"items"`
	StockDeductions []StockDeductionSummary `json:"stock_deductions,omitempty"`
	CreatedAt       time.Time               `json:"created_at"`
}

// Shift merepresentasikan sesi kerja kasir & rekonsiliasi kas (Modul 3)
type Shift struct {
	ID               int        `json:"id"`
	CashierName      string     `json:"cashier_name"`
	OpeningCash      float64    `json:"opening_cash"`
	TotalCashSales   float64    `json:"total_cash_sales"`
	TotalNonCash     float64    `json:"total_non_cash_sales"`
	TransactionCount int        `json:"transaction_count"`
	ExpectedCash     float64    `json:"expected_cash"`
	ActualCash       *float64   `json:"actual_cash,omitempty"`
	Variance         *float64   `json:"variance,omitempty"`
	DiscrepancyType  string     `json:"discrepancy_type"` // MATCH, SHORTAGE, OVERAGE, OPEN
	Notes            string     `json:"notes"`
	Status           string     `json:"status"` // OPEN, CLOSED
	OpenedAt         time.Time  `json:"opened_at"`
	ClosedAt         *time.Time `json:"closed_at,omitempty"`
}

type OpenShiftInput struct {
	CashierName string  `json:"cashier_name"`
	OpeningCash float64 `json:"opening_cash"`
	Notes       string  `json:"notes"`
}

type CloseShiftInput struct {
	ActualCash float64 `json:"actual_cash"`
	Notes      string  `json:"notes"`
}

type StockMovement struct {
	ID              int       `json:"id"`
	RawMaterialID   int       `json:"raw_material_id"`
	RawMaterialName string    `json:"raw_material_name"`
	Unit            string    `json:"unit"`
	TransactionID   *int      `json:"transaction_id,omitempty"`
	MovementType    string    `json:"movement_type"`
	QuantityChange  float64   `json:"quantity_change"`
	StockBefore     float64   `json:"stock_before"`
	StockAfter      float64   `json:"stock_after"`
	Notes           string    `json:"notes"`
	CreatedAt       time.Time `json:"created_at"`
}

type DashboardSummary struct {
	TodayRevenue        float64       `json:"today_revenue"`
	TodayOrders         int           `json:"today_orders"`
	LowStockCount       int           `json:"low_stock_count"`
	LowStockMaterials   []RawMaterial `json:"low_stock_materials"`
	ActiveShift         *Shift        `json:"active_shift,omitempty"`
	RecentTransactions  []Transaction `json:"recent_transactions"`
}
