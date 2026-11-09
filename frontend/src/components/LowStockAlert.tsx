import React from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { RawMaterial } from '../types/erp';

interface LowStockAlertProps {
  materials: RawMaterial[];
  onNavigateToInventory?: () => void;
}

export const LowStockAlert: React.FC<LowStockAlertProps> = ({
  materials,
  onNavigateToInventory,
}) => {
  const lowStockItems = materials.filter(
    (m) => m.is_low_stock || m.stock <= m.min_stock
  );

  if (lowStockItems.length === 0) {
    return null;
  }

  return (
    <div
      role="alert"
      data-testid="low-stock-alert"
      style={{ borderColor: '#FC6C01' }}
      className="bg-[#FFF3EB] border-l-4 border-[#FC6C01] rounded-xl p-3.5 mb-4 flex flex-wrap items-center justify-between gap-3 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span
          style={{ backgroundColor: '#FC6C01' }}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#FC6C01] text-white shrink-0 mt-0.5"
        >
          <AlertTriangle className="w-4 h-4" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-neutral-900">
              Peringatan Stok Menipis (Low Stock Alert)
            </span>
            <span
              style={{ backgroundColor: '#FC6C01' }}
              className="px-2 py-0.5 text-xs font-semibold rounded-full bg-[#FC6C01] text-white"
            >
              {lowStockItems.length} Bahan Baku
            </span>
          </div>
          <p className="text-xs text-neutral-700 mt-1">
            Stok berada di bawah ambang batas minimal:{' '}
            {lowStockItems.map((item, idx) => (
              <span key={item.id} className="font-semibold text-neutral-900">
                {item.name} ({item.stock} / min {item.min_stock} {item.unit})
                {idx < lowStockItems.length - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
        </div>
      </div>

      {onNavigateToInventory && (
        <button
          type="button"
          onClick={onNavigateToInventory}
          style={{ backgroundColor: '#FC6C01' }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#FC6C01] hover:bg-[#e26000] text-white text-xs font-semibold transition shadow-sm"
        >
          <span>Restock Sekarang</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
