-- ============================================================================
-- Mini ERP F&B - Database Schema & Seed Data (PostgreSQL)
-- Supports ACID Transactions for POS, BOM Inventory Deduction, and Shift Cash
-- ============================================================================

BEGIN;

-- 1. Master Data Bahan Baku (Raw Materials)
CREATE TABLE IF NOT EXISTS raw_materials (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    stock NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (stock >= 0),
    min_stock NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
    cost_per_unit NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cost_per_unit >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Master Produk / Menu (Products)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'Makanan',
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Manajemen Resep / Bill of Materials (Product Recipes)
CREATE TABLE IF NOT EXISTS product_recipes (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    raw_material_id INT NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
    quantity_required NUMERIC(12, 2) NOT NULL CHECK (quantity_required > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, raw_material_id)
);

-- 4. Manajemen Shift & Rekonsiliasi Kas (Shifts)
CREATE TABLE IF NOT EXISTS shifts (
    id SERIAL PRIMARY KEY,
    cashier_name VARCHAR(100) NOT NULL,
    opening_cash NUMERIC(12, 2) NOT NULL CHECK (opening_cash >= 0),
    total_cash_sales NUMERIC(12, 2) NOT NULL DEFAULT 0,
    expected_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
    actual_cash NUMERIC(12, 2),
    variance NUMERIC(12, 2),
    notes TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- 5. Transaksi Penjualan POS (Transactions)
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    shift_id INT REFERENCES shifts(id) ON DELETE SET NULL,
    customer_name VARCHAR(100) NOT NULL DEFAULT 'Pelanggan Umum',
    order_type VARCHAR(30) NOT NULL DEFAULT 'DINE_IN' CHECK (order_type IN ('DINE_IN', 'TAKE_AWAY')),
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    tax_amount NUMERIC(12, 2) NOT NULL CHECK (tax_amount >= 0),
    grand_total NUMERIC(12, 2) NOT NULL CHECK (grand_total >= 0),
    payment_method VARCHAR(30) NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'QRIS', 'DEBIT')),
    cash_received NUMERIC(12, 2) NOT NULL DEFAULT 0,
    change_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'PAID' CHECK (status IN ('PAID', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Detail Item Transaksi POS (Transaction Items)
CREATE TABLE IF NOT EXISTS transaction_items (
    id SERIAL PRIMARY KEY,
    transaction_id INT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name VARCHAR(100) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    quantity INT NOT NULL CHECK (quantity > 0),
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0)
);

-- 7. Riwayat Mutasi Stok Bahan Baku (Stock Movements Audit Log)
CREATE TABLE IF NOT EXISTS stock_movements (
    id SERIAL PRIMARY KEY,
    raw_material_id INT NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
    transaction_id INT REFERENCES transactions(id) ON DELETE SET NULL,
    movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN ('SALE_DEDUCTION', 'RESTOCK', 'ADJUSTMENT')),
    quantity_change NUMERIC(12, 2) NOT NULL,
    stock_before NUMERIC(12, 2) NOT NULL,
    stock_after NUMERIC(12, 2) NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_recipes_product_id ON product_recipes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_recipes_raw_material_id ON product_recipes(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shift_id ON transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);

-- ============================================================================
-- Seed Data Awal (Hanya jika tabel masih kosong)
-- ============================================================================
INSERT INTO raw_materials (id, sku, name, unit, stock, min_stock, cost_per_unit)
VALUES
    (1, 'RM-001', 'Beras Pandan Wangi', 'Gram', 5000, 1500, 15),
    (2, 'RM-002', 'Daun Pisang', 'Lembar', 45, 20, 500),
    (3, 'RM-003', 'Ayam Suwir Bumbu Kemangi', 'Gram', 2500, 800, 65),
    (4, 'RM-004', 'Daging Sapi Slice', 'Gram', 600, 750, 120), -- Contoh Low Stock (< min_stock)
    (5, 'RM-005', 'Telur Ayam Negeri', 'Butir', 12, 15, 2000),  -- Contoh Low Stock (< min_stock)
    (6, 'RM-006', 'Biji Kopi Arabika Espresso', 'Gram', 1200, 300, 250),
    (7, 'RM-007', 'Susu Fresh Milk', 'ml', 4000, 1000, 22),
    (8, 'RM-008', 'Gula Aren Cair', 'ml', 900, 300, 35),
    (9, 'RM-009', 'Daun Teh Melati', 'Gram', 800, 200, 40),
    (10, 'RM-010', 'Kentang Shoestring', 'Gram', 3000, 1000, 45)
ON CONFLICT (id) DO NOTHING;

SELECT setval('raw_materials_id_seq', COALESCE((SELECT MAX(id) FROM raw_materials), 1));

INSERT INTO products (id, sku, name, category, price, description, image_url, is_active)
VALUES
    (1, 'MN-001', 'Nasi Bakar Ayam Kemangi', 'Makanan', 28000, 'Nasi gurih bungkus daun pisang dengan isian ayam suwir kemangi pedas harum.', 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=600&q=80', TRUE),
    (2, 'MN-002', 'Rice Bowl Beef Teriyaki + Telur', 'Makanan', 38000, 'Nasi hangat dengan sapi slice saus teriyaki dan telur mata sapi setengah matang.', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80', TRUE),
    (3, 'MN-003', 'Nasi Goreng Kampung Spesial', 'Makanan', 32000, 'Nasi goreng rempah tradisional dengan suwiran ayam dan telur mata sapi.', 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80', TRUE),
    (4, 'MN-004', 'Es Kopi Susu Gula Aren', 'Minuman', 22000, 'Signature espresso kopi arabika dengan fresh milk dan gula aren asli.', 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=600&q=80', TRUE),
    (5, 'MN-005', 'Artisan Jasmine Iced Tea', 'Minuman', 12000, 'Seduhan teh melati pilihan yang segar dan manis pas.', 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80', TRUE),
    (6, 'MN-006', 'Crispy French Fries', 'Snack', 20000, 'Kentang goreng shoestring renyah disajikan dengan saus sambal & keju.', 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80', TRUE)
ON CONFLICT (id) DO NOTHING;

SELECT setval('products_id_seq', COALESCE((SELECT MAX(id) FROM products), 1));

-- Resep BOM (Recipe Linkage)
INSERT INTO product_recipes (product_id, raw_material_id, quantity_required)
VALUES
    -- 1 porsi Nasi Bakar Ayam Kemangi = 150g Beras, 1 Lembar Daun Pisang, 80g Ayam Suwir
    (1, 1, 150),
    (1, 2, 1),
    (1, 3, 80),
    -- 1 porsi Rice Bowl Beef Teriyaki + Telur = 150g Beras, 100g Daging Sapi Slice, 1 Butir Telur
    (2, 1, 150),
    (2, 4, 100),
    (2, 5, 1),
    -- 1 porsi Nasi Goreng Kampung Spesial = 180g Beras, 50g Ayam Suwir, 1 Butir Telur
    (3, 1, 180),
    (3, 3, 50),
    (3, 5, 1),
    -- 1 cup Es Kopi Susu Gula Aren = 18g Kopi Arabika, 150ml Susu Fresh Milk, 25ml Gula Aren
    (4, 6, 18),
    (4, 7, 150),
    (4, 8, 25),
    -- 1 cup Artisan Jasmine Iced Tea = 10g Daun Teh Melati, 15ml Gula Aren
    (5, 9, 10),
    (5, 8, 15),
    -- 1 porsi Crispy French Fries = 200g Kentang Shoestring
    (6, 10, 200)
ON CONFLICT (product_id, raw_material_id) DO NOTHING;

-- Buat 1 Shift Awal yang sedang OPEN agar Kasir dapat langsung bertransaksi atau menutup/membuka shift baru
INSERT INTO shifts (id, cashier_name, opening_cash, total_cash_sales, expected_cash, status, notes)
VALUES
    (1, 'Andi (Shift Pagi)', 500000, 0, 500000, 'OPEN', 'Modal kasir pagi standar')
ON CONFLICT (id) DO NOTHING;

SELECT setval('shifts_id_seq', COALESCE((SELECT MAX(id) FROM shifts), 1));

COMMIT;
