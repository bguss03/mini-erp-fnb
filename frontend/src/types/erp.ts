export interface RawMaterial {
  id: number;
  sku: string;
  name: string;
  unit: string;
  stock: number;
  min_stock: number;
  cost_per_unit: number;
  is_low_stock: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RecipeItem {
  id?: number;
  product_id?: number;
  raw_material_id: number;
  raw_material_sku?: string;
  raw_material_name?: string;
  raw_material_unit?: string;
  available_stock?: number;
  quantity_required: number;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  price: number;
  description: string;
  image_url: string;
  is_active: boolean;
  max_portions: number;
  recipes: RecipeItem[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface StockDeductionSummary {
  raw_material_id: number;
  raw_material_name: string;
  unit: string;
  deducted_qty: number;
  stock_before: number;
  stock_after: number;
  is_low_stock: boolean;
}

export interface TransactionItem {
  id: number;
  transaction_id: number;
  product_id: number;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface Transaction {
  id: number;
  invoice_number: string;
  shift_id?: number;
  customer_name: string;
  order_type: 'DINE_IN' | 'TAKE_AWAY';
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  grand_total: number;
  payment_method: 'CASH' | 'QRIS' | 'DEBIT';
  cash_received: number;
  change_amount: number;
  status: 'PAID' | 'CANCELLED';
  items: TransactionItem[];
  stock_deductions?: StockDeductionSummary[];
  created_at: string;
}

export interface Shift {
  id: number;
  cashier_name: string;
  opening_cash: number;
  total_cash_sales: number;
  total_non_cash_sales: number;
  transaction_count: number;
  expected_cash: number;
  actual_cash?: number;
  variance?: number;
  discrepancy_type: 'OPEN' | 'MATCH' | 'SHORTAGE' | 'OVERAGE';
  notes: string;
  status: 'OPEN' | 'CLOSED';
  opened_at: string;
  closed_at?: string;
}

export interface StockMovement {
  id: number;
  raw_material_id: number;
  raw_material_name: string;
  unit: string;
  transaction_id?: number;
  movement_type: 'SALE_DEDUCTION' | 'RESTOCK' | 'ADJUSTMENT';
  quantity_change: number;
  stock_before: number;
  stock_after: number;
  notes: string;
  created_at: string;
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function calculateCartSummary(items: CartItem[], taxRatePercent = 10) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const taxAmount = Math.round(subtotal * (taxRatePercent / 100));
  const grandTotal = subtotal + taxAmount;
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    subtotal,
    taxRatePercent,
    taxAmount,
    grandTotal,
    totalItems,
  };
}
