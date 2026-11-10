import React, { useState } from 'react';
import {
  Package,
  ChefHat,
  Plus,
  RefreshCw,
  AlertTriangle,
  History,
  Trash2,
  Edit3,
  Check,
} from 'lucide-react';
import {
  Product,
  RawMaterial,
  RecipeItem,
  StockMovement,
  formatRupiah,
} from '../types/erp';

interface InventoryModuleProps {
  rawMaterials: RawMaterial[];
  products: Product[];
  stockMovements: StockMovement[];
  onCreateRawMaterial: (payload: {
    sku?: string;
    name: string;
    unit: string;
    stock: number;
    min_stock: number;
    cost_per_unit: number;
  }) => Promise<void>;
  onAdjustStock: (
    id: number,
    payload: {
      quantity_change: number;
      movement_type: 'RESTOCK' | 'ADJUSTMENT';
      notes: string;
    }
  ) => Promise<void>;
  onSaveProductRecipe: (
    id: number | null,
    payload: {
      name: string;
      category: string;
      price: number;
      description: string;
      image_url: string;
      recipes: RecipeItem[];
    }
  ) => Promise<void>;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({
  rawMaterials,
  products,
  stockMovements,
  onCreateRawMaterial,
  onAdjustStock,
  onSaveProductRecipe,
}) => {
  const [subTab, setSubTab] = useState<'MATERIALS' | 'RECIPES' | 'MOVEMENTS'>(
    'MATERIALS'
  );

  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [matName, setMatName] = useState('');
  const [matUnit, setMatUnit] = useState('Gram');
  const [matStock, setMatStock] = useState('1000');
  const [matMinStock, setMatMinStock] = useState('300');
  const [matCost, setMatCost] = useState('25');

  const [restockTarget, setRestockTarget] = useState<RawMaterial | null>(null);
  const [restockQty, setRestockQty] = useState('500');
  const [restockNotes, setRestockNotes] = useState('Restock dapur harian');

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState('Makanan');
  const [prodPrice, setProdPrice] = useState('28000');
  const [prodDesc, setProdDesc] = useState('');
  const [prodImage, setProdImage] = useState('');
  const [prodRecipes, setProdRecipes] = useState<RecipeItem[]>([]);

  const handleOpenNewProduct = () => {
    setEditingProduct(null);
    setProdName('');
    setProdCategory('Makanan');
    setProdPrice('25000');
    setProdDesc('');
    setProdImage('');
    setProdRecipes(
      rawMaterials.length > 0
        ? [{ raw_material_id: rawMaterials[0].id, quantity_required: 100 }]
        : []
    );
    setShowProductForm(true);
  };

  const handleOpenEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdCategory(p.category);
    setProdPrice(String(p.price));
    setProdDesc(p.description);
    setProdImage(p.image_url);
    setProdRecipes(
      p.recipes.map((r) => ({
        raw_material_id: r.raw_material_id,
        quantity_required: r.quantity_required,
      }))
    );
    setShowProductForm(true);
  };

  const handleAddMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matName.trim()) return;
    await onCreateRawMaterial({
      name: matName.trim(),
      unit: matUnit.trim() || 'Gram',
      stock: Number(matStock) || 0,
      min_stock: Number(matMinStock) || 0,
      cost_per_unit: Number(matCost) || 0,
    });
    setMatName('');
    setShowAddMaterial(false);
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockTarget) return;
    const qty = Number(restockQty);
    if (!qty) return;
    await onAdjustStock(restockTarget.id, {
      quantity_change: qty,
      movement_type: qty >= 0 ? 'RESTOCK' : 'ADJUSTMENT',
      notes: restockNotes || 'Restock manual',
    });
    setRestockTarget(null);
  };

  const handleProductRecipeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) return;
    await onSaveProductRecipe(editingProduct ? editingProduct.id : null, {
      name: prodName.trim(),
      category: prodCategory,
      price: Number(prodPrice) || 0,
      description: prodDesc.trim(),
      image_url: prodImage.trim(),
      recipes: prodRecipes.filter(
        (r) => r.raw_material_id > 0 && r.quantity_required > 0
      ),
    });
    setShowProductForm(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-neutral-200 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 sm:pb-0 max-w-full no-scrollbar">
          <button
            type="button"
            onClick={() => setSubTab('MATERIALS')}
            style={
              subTab === 'MATERIALS'
                ? { backgroundColor: '#FC6C01', color: '#FFFFFF' }
                : undefined
            }
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition ${
              subTab === 'MATERIALS'
                ? 'bg-[#FC6C01] text-white shadow-xs'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Master Bahan ({rawMaterials.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('RECIPES')}
            style={
              subTab === 'RECIPES'
                ? { backgroundColor: '#FC6C01', color: '#FFFFFF' }
                : undefined
            }
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition ${
              subTab === 'RECIPES'
                ? 'bg-[#FC6C01] text-white shadow-xs'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            <span>Resep BOM ({products.length} Menu)</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('MOVEMENTS')}
            style={
              subTab === 'MOVEMENTS'
                ? { backgroundColor: '#FC6C01', color: '#FFFFFF' }
                : undefined
            }
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition ${
              subTab === 'MOVEMENTS'
                ? 'bg-[#FC6C01] text-white shadow-xs'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Log Mutasi Stok</span>
          </button>
        </div>

        <div className="shrink-0">
          {subTab === 'MATERIALS' && (
            <button
              type="button"
              onClick={() => setShowAddMaterial(!showAddMaterial)}
              style={{ backgroundColor: '#FC6C01' }}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#FC6C01] hover:bg-[#e26000] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Bahan Baku</span>
            </button>
          )}
          {subTab === 'RECIPES' && (
            <button
              type="button"
              onClick={handleOpenNewProduct}
              style={{ backgroundColor: '#FC6C01' }}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#FC6C01] hover:bg-[#e26000] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Menu &amp; Resep BOM</span>
            </button>
          )}
        </div>
      </div>

      {subTab === 'MATERIALS' && (
        <div className="space-y-4">
          {showAddMaterial && (
            <form
              onSubmit={handleAddMaterialSubmit}
              className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm grid grid-cols-1 md:grid-cols-6 gap-3 items-end"
            >
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-neutral-600 mb-1">
                  Nama Bahan Baku
                </label>
                <input
                  type="text"
                  required
                  value={matName}
                  onChange={(e) => setMatName(e.target.value)}
                  placeholder="Contoh: Keju Mozzarella"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">
                  Satuan (Unit)
                </label>
                <input
                  type="text"
                  required
                  value={matUnit}
                  onChange={(e) => setMatUnit(e.target.value)}
                  placeholder="Gram / Lembar / ml"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">
                  Stok Fisik Awal
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  step="any"
                  value={matStock}
                  onChange={(e) => setMatStock(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">
                  Batas Min. (Low Stock)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  step="any"
                  value={matMinStock}
                  onChange={(e) => setMatMinStock(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  style={{ backgroundColor: '#FC6C01' }}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#FC6C01] text-white text-xs font-bold"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddMaterial(false)}
                  className="py-2 px-3 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-600"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    <th className="py-3.5 px-4">SKU</th>
                    <th className="py-3.5 px-4">Nama Bahan Baku</th>
                    <th className="py-3.5 px-4">Stok Fisik Saat Ini</th>
                    <th className="py-3.5 px-4">Ambang Minimal</th>
                    <th className="py-3.5 px-4">Status Stok</th>
                    <th className="py-3.5 px-4 text-right">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs">
                  {rawMaterials.map((mat) => {
                    const isLow = mat.is_low_stock || mat.stock <= mat.min_stock;
                    return (
                      <tr
                        key={mat.id}
                        className={
                          isLow ? 'bg-[#FFF3EB]/60 hover:bg-[#FFF3EB]' : 'hover:bg-neutral-50'
                        }
                      >
                        <td className="py-3.5 px-4 font-mono text-neutral-500">
                          {mat.sku}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-neutral-900">
                          {mat.name}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`font-extrabold text-sm ${
                              isLow ? 'text-[#FC6C01]' : 'text-neutral-900'
                            }`}
                          >
                            {mat.stock}
                          </span>{' '}
                          <span className="text-neutral-500">{mat.unit}</span>
                        </td>
                        <td className="py-3.5 px-4 text-neutral-600">
                          {mat.min_stock} {mat.unit}
                        </td>
                        <td className="py-3.5 px-4">
                          {isLow ? (
                            <span
                              style={{ backgroundColor: '#FC6C01' }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FC6C01] text-white"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              <span>LOW STOCK ALERT</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Check className="w-3 h-3" />
                              <span>Stok Aman</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setRestockTarget(mat);
                              setRestockQty('500');
                            }}
                            style={{ backgroundColor: '#FC6C01' }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FC6C01] hover:bg-[#e26000] text-white text-xs font-bold transition"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Restock / Sesuaikan</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {subTab === 'RECIPES' && (
        <div className="space-y-4">
          {showProductForm && (
            <form
              onSubmit={handleProductRecipeSubmit}
              className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <h3 className="text-sm font-bold text-neutral-900">
                  {editingProduct
                    ? `Edit Menu & Resep BOM: ${editingProduct.name}`
                    : 'Tambah Menu Baru & Pengaturan Resep Bahan Baku (BOM)'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowProductForm(false)}
                  className="text-xs text-neutral-500 hover:text-neutral-800"
                >
                  Tutup
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">
                    Nama Menu Produk
                  </label>
                  <input
                    type="text"
                    required
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    placeholder="Contoh: Nasi Bakar Cakalang Pedas"
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">
                    Kategori
                  </label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl bg-white"
                  >
                    <option value="Makanan">Makanan</option>
                    <option value="Minuman">Minuman</option>
                    <option value="Snack">Snack</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">
                    Harga Jual (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900">
                      Komposisi Resep Bahan Baku per 1 Porsi (Bill of Materials)
                    </h4>
                    <p className="text-[11px] text-neutral-500">
                      Stok bahan baku di bawah ini akan otomatis terpotong secara atomik setiap kali menu terjual.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setProdRecipes([
                        ...prodRecipes,
                        {
                          raw_material_id: rawMaterials[0]?.id || 1,
                          quantity_required: 10,
                        },
                      ])
                    }
                    className="px-3 py-1.5 rounded-lg border border-[#FC6C01] text-[#FC6C01] text-xs font-bold hover:bg-[#FFF3EB]"
                  >
                    + Tambah Komponen Bahan
                  </button>
                </div>

                {prodRecipes.map((rec, idx) => (
                  <div key={idx} className="flex items-center gap-2.5">
                    <select
                      value={rec.raw_material_id}
                      onChange={(e) => {
                        const next = [...prodRecipes];
                        next[idx].raw_material_id = Number(e.target.value);
                        setProdRecipes(next);
                      }}
                      className="flex-1 px-3 py-2 text-xs border border-neutral-300 rounded-xl bg-white"
                    >
                      {rawMaterials.map((rm) => (
                        <option key={rm.id} value={rm.id}>
                          {rm.name} (Stok: {rm.stock} {rm.unit})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0.1}
                      step="any"
                      value={rec.quantity_required}
                      onChange={(e) => {
                        const next = [...prodRecipes];
                        next[idx].quantity_required = Number(e.target.value);
                        setProdRecipes(next);
                      }}
                      placeholder="Takaran"
                      className="w-32 px-3 py-2 text-xs border border-neutral-300 rounded-xl bg-white"
                    />
                    <span className="text-xs text-neutral-500 w-16">
                      {
                        rawMaterials.find((r) => r.id === rec.raw_material_id)
                          ?.unit
                      }
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setProdRecipes(prodRecipes.filter((_, i) => i !== idx))
                      }
                      className="p-2 text-neutral-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowProductForm(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#FC6C01' }}
                  className="px-5 py-2 rounded-xl bg-[#FC6C01] text-white text-xs font-bold shadow-xs"
                >
                  Simpan Menu &amp; Resep BOM
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((prod) => (
              <div
                key={prod.id}
                className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-xs flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#FC6C01]">
                        {prod.category} • {prod.sku}
                      </span>
                      <h3 className="text-sm font-bold text-neutral-900 mt-0.5">
                        {prod.name}
                      </h3>
                    </div>
                    <span className="text-sm font-extrabold text-neutral-900">
                      {formatRupiah(prod.price)}
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-neutral-100">
                    <div className="flex items-center justify-between text-[11px] font-bold text-neutral-500 mb-2">
                      <span>RESEP BAHAN BAKU (PER PORSI)</span>
                      <span className="text-neutral-800">
                        Maks. {prod.max_portions} porsi tersedia
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {prod.recipes.map((r) => (
                        <li
                          key={r.raw_material_id}
                          className="text-xs flex items-center justify-between bg-neutral-50 px-2.5 py-1.5 rounded-lg"
                        >
                          <span className="text-neutral-700 font-medium">
                            {r.raw_material_name}
                          </span>
                          <span className="font-bold text-neutral-900">
                            {r.quantity_required} {r.raw_material_unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenEditProduct(prod)}
                  className="w-full py-2 px-3 rounded-xl border border-neutral-200 hover:border-[#FC6C01] hover:text-[#FC6C01] text-xs font-bold text-neutral-700 flex items-center justify-center gap-1.5 transition"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Atur Resep &amp; Harga</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'MOVEMENTS' && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                <th className="py-3.5 px-4">Waktu</th>
                <th className="py-3.5 px-4">Bahan Baku</th>
                <th className="py-3.5 px-4">Tipe Mutasi</th>
                <th className="py-3.5 px-4">Perubahan</th>
                <th className="py-3.5 px-4">Stok Sebelum → Sesudah</th>
                <th className="py-3.5 px-4">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs">
              {stockMovements.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-neutral-400"
                  >
                    Belum ada riwayat mutasi stok bahan baku.
                  </td>
                </tr>
              ) : (
                stockMovements.map((mv) => (
                  <tr key={mv.id} className="hover:bg-neutral-50">
                    <td className="py-3 px-4 text-neutral-500">
                      {new Date(mv.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 font-bold text-neutral-900">
                      {mv.raw_material_name}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          mv.movement_type === 'SALE_DEDUCTION'
                            ? 'bg-[#FFF3EB] text-[#FC6C01]'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {mv.movement_type}
                      </span>
                    </td>
                    <td
                      className={`py-3 px-4 font-extrabold ${
                        mv.quantity_change < 0
                          ? 'text-[#FC6C01]'
                          : 'text-emerald-600'
                      }`}
                    >
                      {mv.quantity_change > 0
                        ? `+${mv.quantity_change}`
                        : mv.quantity_change}{' '}
                      {mv.unit}
                    </td>
                    <td className="py-3 px-4 text-neutral-600">
                      {mv.stock_before} →{' '}
                      <span className="font-bold text-neutral-900">
                        {mv.stock_after} {mv.unit}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-neutral-600">{mv.notes}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {restockTarget && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRestockSubmit}
            className="bg-white rounded-2xl border border-neutral-200 shadow-xl w-full max-w-md p-6 space-y-4"
          >
            <h3 className="text-base font-bold text-neutral-900">
              Restock Bahan Baku: {restockTarget.name}
            </h3>
            <p className="text-xs text-neutral-500">
              Stok saat ini:{' '}
              <span className="font-bold text-neutral-900">
                {restockTarget.stock} {restockTarget.unit}
              </span>{' '}
              (Minimal: {restockTarget.min_stock} {restockTarget.unit})
            </p>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Jumlah Tambahan Stok ({restockTarget.unit})
              </label>
              <input
                type="number"
                required
                step="any"
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                className="w-full px-3 py-2 text-sm font-bold border border-neutral-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Catatan
              </label>
              <input
                type="text"
                value={restockNotes}
                onChange={(e) => setRestockNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRestockTarget(null)}
                className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-600"
              >
                Batal
              </button>
              <button
                type="submit"
                style={{ backgroundColor: '#FC6C01' }}
                className="px-4 py-2 rounded-xl bg-[#FC6C01] text-white text-xs font-bold"
              >
                Simpan Stok
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
