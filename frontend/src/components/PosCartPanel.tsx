import React from 'react';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Utensils,
  X,
} from 'lucide-react';
import {
  CartItem,
  calculateCartSummary,
  formatRupiah,
} from '../types/erp';

interface PosCartPanelProps {
  items: CartItem[];
  customerName: string;
  orderType: 'DINE_IN' | 'TAKE_AWAY';
  onCustomerNameChange: (name: string) => void;
  onOrderTypeChange: (type: 'DINE_IN' | 'TAKE_AWAY') => void;
  onUpdateQty: (productId: number, delta: number) => void;
  onRemoveItem: (productId: number) => void;
  onClearCart: () => void;
  onOpenCheckout: () => void;
  hasActiveShift: boolean;
  onOpenShiftModal?: () => void;
  onCloseMobile?: () => void;
}

export const PosCartPanel: React.FC<PosCartPanelProps> = ({
  items,
  customerName,
  orderType,
  onCustomerNameChange,
  onOrderTypeChange,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onOpenCheckout,
  hasActiveShift,
  onOpenShiftModal,
  onCloseMobile,
}) => {
  const { subtotal, taxRatePercent, taxAmount, grandTotal, totalItems } =
    calculateCartSummary(items, 10);

  return (
    <aside
      aria-label="Keranjang Pesanan"
      className="bg-white border border-neutral-200 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden"
    >
      <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2.5">
          <div
            style={{ backgroundColor: '#FC6C01' }}
            className="w-9 h-9 rounded-xl bg-[#FC6C01] text-white flex items-center justify-center font-bold shadow-sm"
          >
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-900">
              Keranjang Pesanan
            </h2>
            <p className="text-xs text-neutral-500">
              {totalItems} item dipilih
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button
              type="button"
              onClick={onClearCart}
              className="text-xs font-medium text-neutral-500 hover:text-red-600 transition px-2 py-1 rounded-lg hover:bg-neutral-100"
            >
              Kosongkan
            </button>
          )}
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
              aria-label="Tutup Keranjang Mobile"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-3 bg-neutral-50/70 border-b border-neutral-100 space-y-2.5">
        <div className="grid grid-cols-2 gap-1.5 bg-neutral-200/70 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => onOrderTypeChange('DINE_IN')}
            style={
              orderType === 'DINE_IN'
                ? { backgroundColor: '#FC6C01', color: '#FFFFFF' }
                : undefined
            }
            className={`py-1.5 text-xs font-semibold rounded-lg transition ${
              orderType === 'DINE_IN'
                ? 'bg-[#FC6C01] text-white shadow-sm'
                : 'text-neutral-700 hover:bg-white/60'
            }`}
          >
            Dine In (Makan di Tempat)
          </button>
          <button
            type="button"
            onClick={() => onOrderTypeChange('TAKE_AWAY')}
            style={
              orderType === 'TAKE_AWAY'
                ? { backgroundColor: '#FC6C01', color: '#FFFFFF' }
                : undefined
            }
            className={`py-1.5 text-xs font-semibold rounded-lg transition ${
              orderType === 'TAKE_AWAY'
                ? 'bg-[#FC6C01] text-white shadow-sm'
                : 'text-neutral-700 hover:bg-white/60'
            }`}
          >
            Take Away (Bungkus)
          </button>
        </div>

        <input
          type="text"
          value={customerName}
          onChange={(e) => onCustomerNameChange(e.target.value)}
          placeholder="Nama Pelanggan / Nomor Meja..."
          className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-[#FC6C01]"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-10 text-neutral-400">
            <Utensils className="w-10 h-10 mb-2 stroke-[1.5]" />
            <p className="text-sm font-medium text-neutral-600">
              Keranjang masih kosong
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">
              Klik menu di sebelah kiri untuk menambahkan pesanan
            </p>
          </div>
        ) : (
          items.map(({ product, quantity }) => (
            <div
              key={product.id}
              data-testid={`cart-item-${product.id}`}
              className="p-3 rounded-xl border border-neutral-200 bg-white flex items-center justify-between gap-2 hover:border-neutral-300 transition"
            >
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-neutral-900 truncate">
                  {product.name}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {formatRupiah(product.price)} x {quantity} ={' '}
                  <span className="font-semibold text-neutral-900">
                    {formatRupiah(product.price * quantity)}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  aria-label={`Kurangi ${product.name}`}
                  onClick={() => onUpdateQty(product.id, -1)}
                  className="w-7 h-7 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-700 hover:bg-neutral-100 transition"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span
                  data-testid={`cart-qty-${product.id}`}
                  className="w-7 text-center text-xs font-bold text-neutral-900"
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label={`Tambah ${product.name}`}
                  onClick={() => onUpdateQty(product.id, 1)}
                  disabled={quantity >= product.max_portions}
                  style={{ backgroundColor: '#FC6C01' }}
                  className="w-7 h-7 rounded-lg bg-[#FC6C01] text-white flex items-center justify-center hover:bg-[#e26000] disabled:opacity-40 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Hapus ${product.name}`}
                  onClick={() => onRemoveItem(product.id)}
                  className="w-7 h-7 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition ml-0.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-neutral-200 bg-neutral-50/60 space-y-3">
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-neutral-600">
            <span>Subtotal</span>
            <span data-testid="cart-subtotal" className="font-medium text-neutral-900">
              {formatRupiah(subtotal)}
            </span>
          </div>
          <div className="flex justify-between text-neutral-600">
            <span>Pajak Restoran (PB1 {taxRatePercent}%)</span>
            <span data-testid="cart-tax" className="font-medium text-neutral-900">
              {formatRupiah(taxAmount)}
            </span>
          </div>
          <div className="pt-2 border-t border-neutral-200 flex justify-between items-baseline">
            <span className="text-sm font-bold text-neutral-900">
              Grand Total
            </span>
            <span
              data-testid="cart-grand-total"
              style={{ color: '#FC6C01' }}
              className="text-lg font-extrabold text-[#FC6C01]"
            >
              {formatRupiah(grandTotal)}
            </span>
          </div>
        </div>

        {!hasActiveShift && onOpenShiftModal ? (
          <button
            type="button"
            onClick={onOpenShiftModal}
            style={{ backgroundColor: '#FC6C01' }}
            className="w-full py-3 px-4 rounded-xl bg-[#FC6C01] hover:bg-[#e26000] text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2"
          >
            <span>Buka Shift Kasir Terlebih Dahulu</span>
          </button>
        ) : (
          <button
            type="button"
            data-testid="checkout-cta-btn"
            disabled={items.length === 0}
            onClick={onOpenCheckout}
            style={{ backgroundColor: '#FC6C01' }}
            className="w-full py-3.5 px-4 rounded-xl bg-[#FC6C01] hover:bg-[#e26000] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            <span>Bayar Sekarang ({formatRupiah(grandTotal)})</span>
          </button>
        )}
      </div>
    </aside>
  );
};
