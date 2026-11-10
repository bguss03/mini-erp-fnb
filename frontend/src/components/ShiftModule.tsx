import React, { useState } from 'react';
import {
  Clock,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Lock,
  Unlock,
} from 'lucide-react';
import { Shift, formatRupiah } from '../types/erp';

interface ShiftModuleProps {
  activeShift: Shift | null;
  shiftHistory: Shift[];
  onOpenShift: (payload: {
    cashier_name: string;
    opening_cash: number;
    notes: string;
  }) => Promise<void>;
  onCloseShift: (
    shiftId: number,
    payload: { actual_cash: number; notes: string }
  ) => Promise<void>;
}

export const ShiftModule: React.FC<ShiftModuleProps> = ({
  activeShift,
  shiftHistory,
  onOpenShift,
  onCloseShift,
}) => {
  const [cashierName, setCashierName] = useState('Siti (Shift Siang)');
  const [openingCash, setOpeningCash] = useState('500000');
  const [openNotes, setOpenNotes] = useState('Modal kasir standar');

  const [actualCash, setActualCash] = useState<string>(
    activeShift ? String(activeShift.expected_cash) : '500000'
  );
  const [closeNotes, setCloseNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (activeShift) {
      setActualCash(String(activeShift.expected_cash));
    }
  }, [activeShift]);

  const handleOpenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashierName.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onOpenShift({
        cashier_name: cashierName.trim(),
        opening_cash: Number(openingCash) || 0,
        notes: openNotes,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift || submitting) return;
    setSubmitting(true);
    try {
      await onCloseShift(activeShift.id, {
        actual_cash: Number(actualCash) || 0,
        notes: closeNotes,
      });
      setCloseNotes('');
    } finally {
      setSubmitting(false);
    }
  };

  const previewVariance = activeShift
    ? (Number(actualCash) || 0) - activeShift.expected_cash
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {activeShift ? (
          <>
            <div className="lg:col-span-7 bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    style={{ backgroundColor: '#FC6C01' }}
                    className="w-10 h-10 rounded-xl bg-[#FC6C01] text-white flex items-center justify-center"
                  >
                    <Unlock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-neutral-900">
                        Shift Kasir Aktif: {activeShift.cashier_name}
                      </h2>
                      <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        OPEN
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Dibuka pada:{' '}
                      {new Date(activeShift.opened_at).toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-neutral-500">
                    Total Transaksi
                  </span>
                  <p className="text-lg font-extrabold text-neutral-900">
                    {activeShift.transaction_count} Pesanan
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200">
                  <span className="text-xs text-neutral-500">
                    Saldo Awal Kasir (Modal)
                  </span>
                  <p className="text-base font-extrabold text-neutral-900 mt-1">
                    {formatRupiah(activeShift.opening_cash)}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200">
                  <span className="text-xs text-neutral-500">
                    Total Penjualan Tunai (Cash)
                  </span>
                  <p className="text-base font-extrabold text-emerald-600 mt-1">
                    + {formatRupiah(activeShift.total_cash_sales)}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#FFF3EB] border border-[#FC6C01]">
                  <span className="text-xs font-bold text-[#FC6C01]">
                    Expected Cash (Sistem)
                  </span>
                  <p className="text-lg font-extrabold text-neutral-900 mt-1">
                    {formatRupiah(activeShift.expected_cash)}
                  </p>
                </div>
              </div>

              <p className="text-xs text-neutral-500">
                * Penjualan Non-Tunai (QRIS/Debit) pada shift ini:{' '}
                <strong className="text-neutral-800">
                  {formatRupiah(activeShift.total_non_cash_sales || 0)}
                </strong>{' '}
                (tidak masuk perhitungan uang fisik laci kasir).
              </p>
            </div>

            <form
              onSubmit={handleCloseSubmit}
              className="lg:col-span-5 bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-4"
            >
              <div className="flex items-center gap-2.5 border-b border-neutral-100 pb-3">
                <Lock className="w-4 h-4 text-[#FC6C01]" />
                <h3 className="text-sm font-bold text-neutral-900">
                  Clock-out Shift (Tutup Kasir &amp; Hitung Fisik)
                </h3>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Input Hitungan Uang Fisik di Laci Kasir (Actual Cash)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  step="500"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-base font-extrabold border border-neutral-300 rounded-xl focus:outline-none focus:border-[#FC6C01]"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-600">
                  Estimasi Selisih Kas (Variance):
                </span>
                <span
                  className={`font-extrabold text-sm ${
                    previewVariance === 0
                      ? 'text-emerald-600'
                      : previewVariance < 0
                      ? 'text-red-600'
                      : 'text-[#FC6C01]'
                  }`}
                >
                  {previewVariance === 0
                    ? 'Rp 0 (MATCH / Sesuai)'
                    : previewVariance > 0
                    ? `+${formatRupiah(previewVariance)} (OVERAGE / Lebih)`
                    : `${formatRupiah(previewVariance)} (SHORTAGE / Kurang)`}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">
                  Catatan Penutupan Shift
                </label>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Contoh: Selisih kembalian receh Rp 1.000..."
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{ backgroundColor: '#FC6C01' }}
                className="w-full py-3 px-4 rounded-xl bg-[#FC6C01] hover:bg-[#e26000] text-white text-xs font-bold shadow-sm transition"
              >
                {submitting
                  ? 'Menyimpan Rekonsiliasi...'
                  : 'Tutup Shift & Simpan Rekonsiliasi Kas'}
              </button>
            </form>
          </>
        ) : (
          /* Form Clock-in Shift (Buka Kasir) */
          <form
            onSubmit={handleOpenSubmit}
            className="lg:col-span-12 bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs max-w-2xl mx-auto w-full space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-neutral-100 pb-4">
              <div
                style={{ backgroundColor: '#FC6C01' }}
                className="w-10 h-10 rounded-xl bg-[#FC6C01] text-white flex items-center justify-center"
              >
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-900">
                  Clock-in Shift (Buka Kasir Baru)
                </h2>
                <p className="text-xs text-neutral-500">
                  Masukkan Saldo Awal Kasir (uang modal kembalian) sebelum memulai transaksi POS.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Nama Kasir Bertugas
                </label>
                <input
                  type="text"
                  required
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  placeholder="Contoh: Andi (Shift Pagi)"
                  className="w-full px-3.5 py-2.5 text-xs border border-neutral-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Saldo Awal Kasir (Rp)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  step="1000"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-extrabold border border-neutral-300 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">
                Catatan Shift
              </label>
              <input
                type="text"
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-xl"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{ backgroundColor: '#FC6C01' }}
              className="w-full py-3 px-5 rounded-xl bg-[#FC6C01] hover:bg-[#e26000] text-white text-sm font-bold shadow-sm transition"
            >
              Buka Shift Sekarang
            </button>
          </form>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">
              Laporan Rekonsiliasi Shift &amp; Discrepancy Kas
            </h3>
            <p className="text-xs text-neutral-500">
              Perbandingan Expected Cash (Saldo Awal + Penjualan Tunai) dengan Actual Cash (Uang Fisik).
            </p>
          </div>
          <Clock className="w-4 h-4 text-neutral-400" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                <th className="py-3.5 px-4">Kasir &amp; Waktu</th>
                <th className="py-3.5 px-4">Saldo Awal</th>
                <th className="py-3.5 px-4">Penjualan Tunai</th>
                <th className="py-3.5 px-4">Expected Cash</th>
                <th className="py-3.5 px-4">Uang Fisik (Actual)</th>
                <th className="py-3.5 px-4">Selisih (Variance)</th>
                <th className="py-3.5 px-4">Status Rekonsiliasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs">
              {shiftHistory.map((sh) => (
                <tr key={sh.id} className="hover:bg-neutral-50">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-neutral-900">
                      {sh.cashier_name}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {new Date(sh.opened_at).toLocaleString('id-ID')}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-neutral-800">
                    {formatRupiah(sh.opening_cash)}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-emerald-600">
                    + {formatRupiah(sh.total_cash_sales)}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-neutral-900">
                    {formatRupiah(sh.expected_cash)}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-neutral-900">
                    {sh.actual_cash !== undefined
                      ? formatRupiah(sh.actual_cash)
                      : '—'}
                  </td>
                  <td className="py-3.5 px-4 font-extrabold">
                    {sh.variance === undefined ? (
                      <span className="text-neutral-400">Sedang Berjalan</span>
                    ) : sh.variance === 0 ? (
                      <span className="text-emerald-600">Rp 0</span>
                    ) : sh.variance < 0 ? (
                      <span className="text-red-600">
                        {formatRupiah(sh.variance)}
                      </span>
                    ) : (
                      <span className="text-[#FC6C01]">
                        +{formatRupiah(sh.variance)}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    {sh.status === 'OPEN' ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700">
                        SHIFT OPEN
                      </span>
                    ) : sh.discrepancy_type === 'MATCH' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>MATCH (Sesuai)</span>
                      </span>
                    ) : (
                      <span
                        style={{ backgroundColor: '#FC6C01' }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FC6C01] text-white"
                      >
                        <AlertCircle className="w-3 h-3" />
                        <span>
                          {sh.discrepancy_type === 'SHORTAGE'
                            ? 'SHORTAGE (Kurang)'
                            : 'OVERAGE (Lebih)'}
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
