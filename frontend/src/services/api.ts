import {
  Product,
  RawMaterial,
  Shift,
  StockMovement,
  Transaction,
  RecipeItem,
} from '../types/erp';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data?.error || `Terjadi kesalahan HTTP ${res.status}`;
    throw new Error(errorMsg);
  }
  return data as T;
}

export const erpApi = {
  // Products & BOM Recipes
  listProducts: () => request<Product[]>('/products'),
  createProduct: (payload: {
    sku?: string;
    name: string;
    category: string;
    price: number;
    description: string;
    image_url: string;
    recipes: RecipeItem[];
  }) =>
    request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateProduct: (
    id: number,
    payload: {
      name: string;
      category: string;
      price: number;
      description: string;
      image_url: string;
      is_active?: boolean;
      recipes: RecipeItem[];
    }
  ) =>
    request<Product>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteProduct: (id: number) =>
    request<{ message: string }>(`/products/${id}`, { method: 'DELETE' }),

  // Raw Materials (Inventory)
  listRawMaterials: () => request<RawMaterial[]>('/raw-materials'),
  createRawMaterial: (payload: {
    sku?: string;
    name: string;
    unit: string;
    stock: number;
    min_stock: number;
    cost_per_unit: number;
  }) =>
    request<RawMaterial>('/raw-materials', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateRawMaterial: (
    id: number,
    payload: {
      name: string;
      unit: string;
      stock: number;
      min_stock: number;
      cost_per_unit: number;
    }
  ) =>
    request<RawMaterial>(`/raw-materials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  adjustStock: (
    id: number,
    payload: {
      quantity_change: number;
      movement_type: 'RESTOCK' | 'ADJUSTMENT';
      notes: string;
    }
  ) =>
    request<RawMaterial>(`/raw-materials/${id}/adjust`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listStockMovements: () => request<StockMovement[]>('/stock-movements'),

  // POS Transactions
  checkout: (payload: {
    shift_id?: number;
    customer_name: string;
    order_type: 'DINE_IN' | 'TAKE_AWAY';
    payment_method: 'CASH' | 'QRIS' | 'DEBIT';
    cash_received: number;
    items: { product_id: number; quantity: number }[];
  }) =>
    request<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listTransactions: () => request<Transaction[]>('/transactions'),

  // Shift & Cash Management
  getActiveShift: () =>
    request<{ active_shift: Shift | null }>('/shifts/active'),
  listShifts: () => request<Shift[]>('/shifts'),
  openShift: (payload: {
    cashier_name: string;
    opening_cash: number;
    notes: string;
  }) =>
    request<Shift>('/shifts/open', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  closeShift: (
    shiftId: number,
    payload: { actual_cash: number; notes: string }
  ) =>
    request<Shift>(`/shifts/${shiftId}/close`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
