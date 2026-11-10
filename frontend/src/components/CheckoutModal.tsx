import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Banknote, QrCode, CreditCard } from 'lucide-react';
import {
  CartItem,
  calculateCartSummary,
  formatRupiah,
} from '../types/erp';

interface CheckoutModalProps {
  isOpen: boolean;
  items: CartItem[];
  customerName: string;
  orderType: 'DINE_IN' | 'TAKE_AWAY';
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onConfirmCheckout: (payload: {
    payment_method: 'CASH' | 'QRIS' | 'DEBIT';
    cash_received: number;
  }) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  items,
  customerName,
  orderType,
  isSubmitting = false,
  errorMessage = null,
  onClose,
  onConfirmCheckout,
}) => {
  const { subtotal, taxRatePercent, taxAmount, grandTotal } =
    calculateCartSummary(items, 10);

  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'DEBIT'>(
    'CASH'
  );
  const [cashInput, setCashInput] = useState<string>(String(grandTotal));

  useEffect(() => {
    if (isOpen) {
      setCashInput(String(grandTotal));
      setPaymentMethod('CASH');
    }
  }, [isOpen, grandTotal]);

  if (!isOpen) return null;

  const numericCash = Number(cashInput) || 0;
  const effectiveCash = paymentMethod === 'CASH' ? numericCash : grandTotal;
  const changeAmount =
    paymentMethod === 'CASH' ? Math.max(0, numericCash - grandTotal) : 0;
  const isCashEnough = paymentMethod !== 'CASH' || numericCash >= grandTotal;

  const quickNominals = [
    grandTotal,
    Math.ceil(grandTotal / 50000) * 50000,
    100000,
    200000,
  ].filter((v, i, arr) => v >= grandTotal && arr.indexOf(v) === i);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCashEnough || isSubmitting) return;
    onConfirmCheckout({
      payment_method: paymentMethod,
      cash_received: effectiveCash,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modal Pembayaran Kasir"
      data-testid="checkout-modal"
      className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-neutral-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-neutral-900">
              Konfirmasi Pembayaran POS
            </h2>
            <p className="text-xs text-neutral-500">
              {customerName || 'Pelanggan Umum'} •{' '}
              {orderType === 'DINE_IN' ? 'Dine In' : 'Take Away'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-xs text-neutral-600">
              <span>Subtotal ({items.length} menu)</span>
              <span className="font-semibold text-neutral-900">
                {formatRupiah(subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-neutral-600">
              <span>PB1 ({taxRatePercent}%)</span>
              <span className="font-semibold text-neutral-900">
                {formatRupiah(taxAmount)}
              </span>
            </div>
            <div className="pt-2 border-t border-neutral-200 flex justify-between items-center">
              <span className="text-sm font-bold text-neutral-900">
                Total Tagihan (Grand Total)
              </span>
              <span
                data-testid="modal-grand-total"
                style={{ color: '#FC6C01' }}
                className="text-xl font-extrabold text-[#FC6C01]"
              >
                {formatRupiah(grandTotal)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
              Metode Pembayaran
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  { id: 'CASH', label: 'Tunai (Cash)', icon: Banknote },
                  { id: 'QRIS', label: 'QRIS Statis/Dinamis', icon: QrCode },
                  { id: 'DEBIT', label: 'Kartu Debit/EDC', icon: CreditCard },
                ] as const
              ).map(({ id, label, icon: Icon }) => {
                const active = paymentMethod === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPaymentMethod(id)}
                    style={
                      active
                        ? {
                            borderColor: '#FC6C01',
                            backgroundColor: '#FFF3EB',
                          }
                        : undefined
                    }
                    className={`p-3 rounded-xl border text-left transition flex flex-col gap-1.5 ${
                      active
                        ? 'border-[#FC6C01] bg-[#FFF3EB] text-neutral-900'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                    }`}
                  >
                    <Icon
                      style={active ? { color: '#FC6C01' } : undefined}
                      className="w-4 h-4"
                    />
                    <span className="text-xs font-bold">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {paymentMethod === 'CASH' && (
            <div className="space-y-2.5">
              <label
                htmlFor="cash-received-input"
                className="block text-xs font-bold uppercase tracking-wider text-neutral-500"
              >
                Nominal Uang Tunai Diterima (Rp)
              </label>
              <input
                id="cash-received-input"
                data-testid="cash-received-input"
                type="number"
                min={0}
                step="500"
                value={cashInput}
                onChange={(e) => setCashInput(e.target.value)}
                className="w-full px-4 py-2.5 text-base font-bold border border-neutral-300 rounded-xl focus:outline-none focus:border-[#FC6C01]"
              />
              <div className="flex flex-wrap gap-2">
                {quickNominals.map((nom) => (
                  <button
                    key={nom}
                    type="button"
                    onClick={() => setCashInput(String(nom))}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-200 bg-neutral-50 hover:border-[#FC6C01] hover:text-[#FC6C01] transition"
                  >
                    {nom === grandTotal ? 'Uang Pas' : formatRupiah(nom)}
                  </button>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2 text-sm">
                <span className="text-neutral-600 font-medium">
                  Uang Kembalian:
                </span>
                <span
                  data-testid="modal-change-amount"
                  className={`font-extrabold ${
                    isCashEnough ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {isCashEnough
                    ? formatRupiah(changeAmount)
                    : 'Nominal uang kurang'}
                </span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700"
            >
              {errorMessage}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Batal
            </button>
            <button
              type="submit"
              data-testid="confirm-payment-btn"
              disabled={!isCashEnough || isSubmitting}
              style={{ backgroundColor: '#FC6C01' }}
              className="px-5 py-2.5 rounded-xl bg-[#FC6C01] hover:bg-[#e26000] disabled:opacity-40 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Memproses Transaksi & Stok...'
                  : 'Selesaikan Pembayaran (PAID)'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
