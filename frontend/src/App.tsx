import React, { useEffect, useState, useCallback } from 'react';
import {
  Store as StoreIcon,
  ShoppingBag,
  Package,
  Wallet,
  Receipt,
  Search,
  RefreshCw,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import {
  CartItem,
  Product,
  RawMaterial,
  RecipeItem,
  Shift,
  StockMovement,
  Transaction,
  formatRupiah,
  calculateCartSummary,
} from './types/erp';
import { erpApi } from './services/api';
import { LowStockAlert } from './components/LowStockAlert';
import { PosCartPanel } from './components/PosCartPanel';
import { CheckoutModal } from './components/CheckoutModal';
import { InventoryModule } from './components/InventoryModule';
import { ShiftModule } from './components/ShiftModule';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'POS' | 'INVENTORY' | 'SHIFT' | 'TRANSACTIONS'
  >('POS');

  const [products, setProducts] = useState<Product[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [shiftHistory, setShiftHistory] = useState<Shift[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('Pelanggan Meja 01');
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKE_AWAY'>(
    'DINE_IN'
  );
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState<boolean>(false);
  const [isSubmittingCheckout, setIsSubmittingCheckout] =
    useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [lastCompletedTx, setLastCompletedTx] = useState<Transaction | null>(
    null
  );

  const loadAllData = useCallback(async () => {
    try {
      setBannerError(null);
      const [prods, mats, movs, activeSh, shifts, txs] = await Promise.all([
        erpApi.listProducts(),
        erpApi.listRawMaterials(),
        erpApi.listStockMovements(),
        erpApi.getActiveShift(),
        erpApi.listShifts(),
        erpApi.listTransactions(),
      ]);
      setProducts(prods);
      setRawMaterials(mats);
      setStockMovements(movs);
      setActiveShift(activeSh.active_shift);
      setShiftHistory(shifts);
      setTransactions(txs);
    } catch (err) {
      setBannerError(
        err instanceof Error
          ? err.message
          : 'Gagal memuat data dari server backend Golang'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  const handleAddToCart = (product: Product) => {
    if (product.max_portions <= 0) return;
    setCart((prev) => {
      const existing = prev.find((it) => it.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.max_portions) return prev;
        return prev.map((it) =>
          it.product.id === product.id
            ? { ...it, quantity: it.quantity + 1 }
            : it
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleUpdateQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((it) =>
          it.product.id === productId
            ? { ...it, quantity: it.quantity + delta }
            : it
        )
        .filter((it) => it.quantity > 0)
    );
  };

  const handleRemoveItem = (productId: number) => {
    setCart((prev) => prev.filter((it) => it.product.id !== productId));
  };

  const handleClearCart = () => setCart([]);

  const handleConfirmCheckout = async (paymentPayload: {
    payment_method: 'CASH' | 'QRIS' | 'DEBIT';
    cash_received: number;
  }) => {
    setIsSubmittingCheckout(true);
    setCheckoutError(null);
    try {
      const createdTx = await erpApi.checkout({
        shift_id: activeShift?.id,
        customer_name: customerName || 'Pelanggan Umum',
        order_type: orderType,
        payment_method: paymentPayload.payment_method,
        cash_received: paymentPayload.cash_received,
        items: cart.map((c) => ({
          product_id: c.product.id,
          quantity: c.quantity,
        })),
      });
      setCart([]);
      setIsCheckoutOpen(false);
      setLastCompletedTx(createdTx);
      await loadAllData();
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : 'Transaksi gagal diproses'
      );
    } finally {
      setIsSubmittingCheckout(false);
    }
  };

  const handleCreateRawMaterial = async (payload: {
    sku?: string;
    name: string;
    unit: string;
    stock: number;
    min_stock: number;
    cost_per_unit: number;
  }) => {
    await erpApi.createRawMaterial(payload);
    await loadAllData();
  };

  const handleAdjustStock = async (
    id: number,
    payload: {
      quantity_change: number;
      movement_type: 'RESTOCK' | 'ADJUSTMENT';
      notes: string;
    }
  ) => {
    await erpApi.adjustStock(id, payload);
    await loadAllData();
  };

  const handleSaveProductRecipe = async (
    id: number | null,
    payload: {
      name: string;
      category: string;
      price: number;
      description: string;
      image_url: string;
      recipes: RecipeItem[];
    }
  ) => {
    if (id) {
      await erpApi.updateProduct(id, payload);
    } else {
      await erpApi.createProduct(payload);
    }
    await loadAllData();
  };

  const handleOpenShift = async (payload: {
    cashier_name: string;
    opening_cash: number;
    notes: string;
  }) => {
    await erpApi.openShift(payload);
    await loadAllData();
  };

  const handleCloseShift = async (
    shiftId: number,
    payload: { actual_cash: number; notes: string }
  ) => {
    await erpApi.closeShift(shiftId, payload);
    await loadAllData();
  };

  const categories = [
    'Semua',
    ...Array.from(new Set(products.map((p) => p.category))),
  ];

  const filteredProducts = products.filter((p) => {
    const matchCategory =
      selectedCategory === 'Semua' || p.category === selectedCategory;
    const matchQuery =
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchQuery;
  });

  const lowStockCount = rawMaterials.filter(
    (m) => m.is_low_stock || m.stock <= m.min_stock
  ).length;

  const mobileCartSummary = calculateCartSummary(cart, 10);

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col">
      <header className="sticky top-0 z-30 bg-white border-b border-neutral-200 px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            style={{ backgroundColor: '#FC6C01' }}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#FC6C01] text-white flex items-center justify-center shadow-sm shrink-0"
          >
            <StoreIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-neutral-900">
                MINI ERP F&amp;B
              </h1>
              <span
                style={{ backgroundColor: '#FFF3EB', color: '#FC6C01' }}
                className="hidden sm:inline px-2 py-0.5 text-[10px] font-extrabold rounded-full uppercase"
              >
                POS • BOM • Shift
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-neutral-500 hidden sm:block">
              Sistem Kasir Terintegrasi Resep Dapur &amp; Rekonsiliasi Kas ACID
            </p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1.5 bg-neutral-100 p-1.5 rounded-2xl">
          {(
            [
              { id: 'POS', label: 'Kasir POS', icon: ShoppingBag },
              {
                id: 'INVENTORY',
                label: 'Inventaris & Resep BOM',
                icon: Package,
                badge: lowStockCount > 0 ? lowStockCount : undefined,
              },
              {
                id: 'SHIFT',
                label: 'Shift & Rekonsiliasi Kas',
                icon: Wallet,
              },
              {
                id: 'TRANSACTIONS',
                label: 'Riwayat Transaksi',
                icon: Receipt,
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={
                  active
                    ? { backgroundColor: '#FC6C01', color: '#FFFFFF' }
                    : undefined
                }
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                  active
                    ? 'bg-[#FC6C01] text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {'badge' in tab && tab.badge ? (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                      active
                        ? 'bg-white text-[#FC6C01]'
                        : 'bg-[#FC6C01] text-white'
                    }`}
                  >
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('SHIFT')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-[11px] sm:text-xs font-bold flex items-center gap-1.5 sm:gap-2 transition ${
              activeShift
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-[#FF6666] bg-[#ff4646] text-white'
            }`}
          >
            <span className="truncate max-w-[130px] sm:max-w-none">
              {activeShift
                ? `${activeShift.cashier_name} • ${formatRupiah(
                    activeShift.expected_cash
                  )}`
                : 'Shift Belum Dibuka'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => void loadAllData()}
            title="Muat ulang data"
            className="p-1.5 sm:p-2 rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-100 transition shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="flex-1 p-3.5 sm:p-6 pb-28 md:pb-8 max-w-[1600px] w-full mx-auto">
        {bannerError && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">
            {bannerError}
          </div>
        )}

        <LowStockAlert
          materials={rawMaterials}
          onNavigateToInventory={
            activeTab !== 'INVENTORY'
              ? () => setActiveTab('INVENTORY')
              : undefined
          }
        />

        {activeTab === 'POS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <section className="lg:col-span-8 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-neutral-200 shadow-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  {categories.map((cat) => {
                    const active = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        style={
                          active
                            ? { backgroundColor: '#FC6C01', color: '#FFFFFF' }
                            : undefined
                        }
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                          active
                            ? 'bg-[#FC6C01] text-white shadow-xs'
                            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama menu atau SKU..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-[#FC6C01]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredProducts.map((product) => {
                  const inCart = cart.find(
                    (it) => it.product.id === product.id
                  );
                  const outOfStock = product.max_portions <= 0;

                  return (
                    <div
                      key={product.id}
                      data-testid={`product-card-${product.id}`}
                      className={`group bg-white rounded-2xl border transition overflow-hidden flex flex-col justify-between ${
                        inCart
                          ? 'border-[#FC6C01] ring-2 ring-[#FC6C01]/20'
                          : 'border-neutral-200 hover:border-neutral-300'
                      } shadow-xs`}
                    >
                      <div>
                        <div className="p-4 pb-3">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600">
                              {product.category}
                            </span>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                outOfStock
                                  ? 'bg-red-100 text-red-700'
                                  : product.max_portions <= 5
                                  ? 'bg-[#FFF3EB] text-[#FC6C01]'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {outOfStock
                                ? 'Stok Bahan Habis'
                                : `Tersedia ${product.max_portions} porsi`}
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-neutral-900">
                            {product.name}
                          </h3>
                          <p className="text-xs text-neutral-500 line-clamp-2 mt-1">
                            {product.description}
                          </p>

                          {product.recipes.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-neutral-100">
                              <span className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">
                                Resep BOM (Otomatis Potong Stok):
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {product.recipes.map((r) => (
                                  <span
                                    key={r.raw_material_id}
                                    className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-neutral-50 border border-neutral-200 text-neutral-600"
                                  >
                                    {r.raw_material_name}: {r.quantity_required}
                                    {r.raw_material_unit}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="px-4 py-3 bg-neutral-50/70 border-t border-neutral-100 flex items-center justify-between">
                        <span className="text-base font-extrabold text-neutral-900">
                          {formatRupiah(product.price)}
                        </span>
                        <button
                          type="button"
                          disabled={outOfStock}
                          onClick={() => handleAddToCart(product)}
                          style={{ backgroundColor: '#FC6C01' }}
                          className="px-3.5 py-2 rounded-xl bg-[#FC6C01] hover:bg-[#e26000] disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>
                            {inCart ? `Tambah (${inCart.quantity})` : 'Tambah'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="hidden lg:block lg:col-span-4 lg:sticky lg:top-20">
              <PosCartPanel
                items={cart}
                customerName={customerName}
                orderType={orderType}
                onCustomerNameChange={setCustomerName}
                onOrderTypeChange={setOrderType}
                onUpdateQty={handleUpdateQty}
                onRemoveItem={handleRemoveItem}
                onClearCart={handleClearCart}
                onOpenCheckout={() => {
                  setCheckoutError(null);
                  setIsCheckoutOpen(true);
                }}
                hasActiveShift={Boolean(activeShift)}
                onOpenShiftModal={() => setActiveTab('SHIFT')}
              />
            </div>
          </div>
        )}

        {activeTab === 'POS' && cart.length > 0 && (
          <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 p-3 bg-gradient-to-t from-white via-white/95 to-transparent">
            <button
              type="button"
              onClick={() => setIsMobileCartOpen(true)}
              style={{ backgroundColor: '#FC6C01' }}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#FC6C01] hover:bg-[#e26000] text-white font-bold text-xs sm:text-sm shadow-xl flex items-center justify-between transition active:scale-95"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-white/25 flex items-center justify-center text-xs font-black">
                  {mobileCartSummary.totalItems}
                </span>
                <span>Keranjang Pesanan</span>
              </div>
              <div className="flex items-center gap-1.5 font-extrabold">
                <span>{formatRupiah(mobileCartSummary.grandTotal)}</span>
                <span className="text-white/80 text-sm">Lihat →</span>
              </div>
            </button>
          </div>
        )}

        {isMobileCartOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-xs flex flex-col justify-end">
            <div className="bg-white rounded-t-3xl max-h-[85vh] h-[85vh] flex flex-col overflow-hidden shadow-2xl">
              <PosCartPanel
                items={cart}
                customerName={customerName}
                orderType={orderType}
                onCustomerNameChange={setCustomerName}
                onOrderTypeChange={setOrderType}
                onUpdateQty={handleUpdateQty}
                onRemoveItem={handleRemoveItem}
                onClearCart={handleClearCart}
                onOpenCheckout={() => {
                  setIsMobileCartOpen(false);
                  setCheckoutError(null);
                  setIsCheckoutOpen(true);
                }}
                hasActiveShift={Boolean(activeShift)}
                onOpenShiftModal={() => {
                  setIsMobileCartOpen(false);
                  setActiveTab('SHIFT');
                }}
                onCloseMobile={() => setIsMobileCartOpen(false)}
              />
            </div>
          </div>
        )}

        {activeTab === 'INVENTORY' && (
          <InventoryModule
            rawMaterials={rawMaterials}
            products={products}
            stockMovements={stockMovements}
            onCreateRawMaterial={handleCreateRawMaterial}
            onAdjustStock={handleAdjustStock}
            onSaveProductRecipe={handleSaveProductRecipe}
          />
        )}

        {activeTab === 'SHIFT' && (
          <ShiftModule
            activeShift={activeShift}
            shiftHistory={shiftHistory}
            onOpenShift={handleOpenShift}
            onCloseShift={handleCloseShift}
          />
        )}

        {activeTab === 'TRANSACTIONS' && (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-neutral-900">
                  Riwayat Transaksi Penjualan (Status PAID)
                </h2>
                <p className="text-xs text-neutral-500">
                  Setiap transaksi di bawah ini telah memotong stok bahan baku resep secara atomik.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[650px]">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    <th className="py-3.5 px-4">No. Invoice &amp; Waktu</th>
                    <th className="py-3.5 px-4">Pelanggan</th>
                    <th className="py-3.5 px-4">Item Pesanan</th>
                    <th className="py-3.5 px-4">Subtotal + PB1 10%</th>
                    <th className="py-3.5 px-4">Grand Total</th>
                    <th className="py-3.5 px-4">Metode &amp; Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs">
                  {transactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-neutral-400"
                      >
                        Belum ada transaksi penjualan.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-neutral-50">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-neutral-900">
                            {tx.invoice_number}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {new Date(tx.created_at).toLocaleString('id-ID')}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-neutral-900">
                            {tx.customer_name}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {tx.order_type}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <ul className="space-y-0.5">
                            {tx.items.map((it) => (
                              <li key={it.id} className="text-neutral-700">
                                {it.quantity}x {it.product_name}
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="py-3.5 px-4 text-neutral-600">
                          {formatRupiah(tx.subtotal)} +{' '}
                          {formatRupiah(tx.tax_amount)}
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-[#FC6C01]">
                          {formatRupiah(tx.grand_total)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {tx.payment_method} • {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <CheckoutModal
        isOpen={isCheckoutOpen}
        items={cart}
        customerName={customerName}
        orderType={orderType}
        isSubmitting={isSubmittingCheckout}
        errorMessage={checkoutError}
        onClose={() => setIsCheckoutOpen(false)}
        onConfirmCheckout={handleConfirmCheckout}
      />

      {lastCompletedTx && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div
                style={{ backgroundColor: '#FC6C01' }}
                className="w-10 h-10 rounded-xl bg-[#FC6C01] text-white flex items-center justify-center"
              >
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Transaksi Berhasil ({lastCompletedTx.status})
                </h3>
                <p className="text-xs font-mono text-neutral-500">
                  {lastCompletedTx.invoice_number}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-600">Grand Total</span>
                <span className="font-extrabold text-neutral-900">
                  {formatRupiah(lastCompletedTx.grand_total)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">
                  Dibayar ({lastCompletedTx.payment_method})
                </span>
                <span className="font-semibold text-neutral-800">
                  {formatRupiah(lastCompletedTx.cash_received)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Kembalian</span>
                <span className="font-bold text-emerald-600">
                  {formatRupiah(lastCompletedTx.change_amount)}
                </span>
              </div>
            </div>

            {lastCompletedTx.stock_deductions &&
              lastCompletedTx.stock_deductions.length > 0 && (
                <div className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    Potongan Stok Bahan Baku Otomatis (ACID Transaction):
                  </span>
                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    {lastCompletedTx.stock_deductions.map((d) => (
                      <div
                        key={d.raw_material_id}
                        className="text-xs flex items-center justify-between px-3 py-2 rounded-lg bg-[#FFF3EB]/60 border border-[#FC6C01]/30"
                      >
                        <span className="font-semibold text-neutral-800">
                          {d.raw_material_name}
                        </span>
                        <span className="font-bold text-[#FC6C01]">
                          -{d.deducted_qty} {d.unit} (Sisa: {d.stock_after}{' '}
                          {d.unit})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            <button
              type="button"
              onClick={() => setLastCompletedTx(null)}
              style={{ backgroundColor: '#FC6C01' }}
              className="w-full py-2.5 rounded-xl bg-[#FC6C01] hover:bg-[#e26000] text-white text-xs font-bold"
            >
              Transaksi Baru
            </button>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-200 px-3 py-1.5 flex items-center justify-around shadow-lg">
        {(
          [
            { id: 'POS', label: 'Kasir', icon: ShoppingBag },
            {
              id: 'INVENTORY',
              label: 'Inventaris',
              icon: Package,
              badge: lowStockCount > 0 ? lowStockCount : undefined,
            },
            { id: 'SHIFT', label: 'Shift Kas', icon: Wallet },
            { id: 'TRANSACTIONS', label: 'Riwayat', icon: Receipt },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
                active ? 'text-[#FC6C01] font-bold' : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
              <span className="text-[10px] mt-0.5">{tab.label}</span>
              {'badge' in tab && tab.badge ? (
                <span
                  style={{ backgroundColor: '#FC6C01' }}
                  className="absolute top-0 right-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-[#FC6C01] text-white"
                >
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default App;
