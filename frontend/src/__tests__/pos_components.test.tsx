import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LowStockAlert } from '../components/LowStockAlert';
import { PosCartPanel } from '../components/PosCartPanel';
import { CheckoutModal } from '../components/CheckoutModal';
import { CartItem, Product, RawMaterial } from '../types/erp';

const sampleProductNasiBakar: Product = {
  id: 1,
  sku: 'MN-001',
  name: 'Nasi Bakar Ayam Kemangi',
  category: 'Makanan',
  price: 28000,
  description: 'Nasi gurih bungkus daun pisang',
  image_url: '',
  is_active: true,
  max_portions: 15,
  recipes: [
    { raw_material_id: 1, raw_material_name: 'Beras', quantity_required: 150, raw_material_unit: 'Gram' },
    { raw_material_id: 2, raw_material_name: 'Daun Pisang', quantity_required: 1, raw_material_unit: 'Lembar' },
  ],
};

const sampleProductKopi: Product = {
  id: 4,
  sku: 'MN-004',
  name: 'Es Kopi Susu Gula Aren',
  category: 'Minuman',
  price: 22000,
  description: 'Kopi susu gula aren',
  image_url: '',
  is_active: true,
  max_portions: 20,
  recipes: [],
};

describe('Frontend Component Testing (React): POS Cart, Checkout Modal & Low Stock Alert', () => {
  it('merender peringatan Low Stock Alert berwarna #FC6C01 saat stok bahan baku di bawah ambang minimal', () => {
    const materials: RawMaterial[] = [
      {
        id: 1,
        sku: 'RM-001',
        name: 'Beras Pandan Wangi',
        unit: 'Gram',
        stock: 5000,
        min_stock: 1500,
        cost_per_unit: 15,
        is_low_stock: false,
      },
      {
        id: 4,
        sku: 'RM-004',
        name: 'Daging Sapi Slice',
        unit: 'Gram',
        stock: 600,
        min_stock: 750,
        cost_per_unit: 120,
        is_low_stock: true,
      },
    ];

    render(<LowStockAlert materials={materials} />);

    const alertEl = screen.getByTestId('low-stock-alert');
    expect(alertEl).toBeInTheDocument();
    expect(alertEl).toHaveTextContent('Peringatan Stok Menipis (Low Stock Alert)');
    expect(alertEl).toHaveTextContent('Daging Sapi Slice (600 / min 750 Gram)');
    // Memastikan warna palet utama #FC6C01 diterapkan
    expect(alertEl).toHaveStyle({ borderColor: '#FC6C01' });
  });

  it('merender komponen Keranjang Pesanan dan menghitung Subtotal, PB1 10%, serta Grand Total sesuai state pesanan', () => {
    const cartItems: CartItem[] = [
      { product: sampleProductNasiBakar, quantity: 2 }, // 56.000
      { product: sampleProductKopi, quantity: 1 },      // 22.000
    ];
    const onUpdateQty = vi.fn();
    const onRemoveItem = vi.fn();
    const onOpenCheckout = vi.fn();

    render(
      <PosCartPanel
        items={cartItems}
        customerName="Meja 05"
        orderType="DINE_IN"
        onCustomerNameChange={() => {}}
        onOrderTypeChange={() => {}}
        onUpdateQty={onUpdateQty}
        onRemoveItem={onRemoveItem}
        onClearCart={() => {}}
        onOpenCheckout={onOpenCheckout}
        hasActiveShift={true}
      />
    );

    expect(screen.getByText('Nasi Bakar Ayam Kemangi')).toBeInTheDocument();
    expect(screen.getByText('Es Kopi Susu Gula Aren')).toBeInTheDocument();

    // Subtotal = 78.000, PB1 10% = 7.800, Grand Total = 85.800
    expect(screen.getByTestId('cart-subtotal').textContent).toContain('78.000');
    expect(screen.getByTestId('cart-tax').textContent).toContain('7.800');
    expect(screen.getByTestId('cart-grand-total').textContent).toContain('85.800');

    // Klik tombol tambah qty dan tombol Bayar Sekarang
    fireEvent.click(screen.getByLabelText('Tambah Nasi Bakar Ayam Kemangi'));
    expect(onUpdateQty).toHaveBeenCalledWith(1, 1);

    fireEvent.click(screen.getByTestId('checkout-cta-btn'));
    expect(onOpenCheckout).toHaveBeenCalledTimes(1);
  });

  it('merender Modal Pembayaran, menghitung uang kembalian, dan mengirim payload checkout berstatus PAID', () => {
    const cartItems: CartItem[] = [
      { product: sampleProductNasiBakar, quantity: 2 }, // 56.000
      { product: sampleProductKopi, quantity: 1 },      // 22.000 -> Grand Total 85.800
    ];
    const onConfirmCheckout = vi.fn();

    render(
      <CheckoutModal
        isOpen={true}
        items={cartItems}
        customerName="Pelanggan VIP"
        orderType="DINE_IN"
        onClose={() => {}}
        onConfirmCheckout={onConfirmCheckout}
      />
    );

    expect(screen.getByTestId('checkout-modal')).toBeInTheDocument();
    expect(screen.getByTestId('modal-grand-total').textContent).toContain('85.800');

    // Input uang tunai diterima Rp 100.000 -> Kembalian harus Rp 14.200
    const cashInput = screen.getByTestId('cash-received-input');
    fireEvent.change(cashInput, { target: { value: '100000' } });

    expect(screen.getByTestId('modal-change-amount').textContent).toContain('14.200');

    // Submit pembayaran
    fireEvent.click(screen.getByTestId('confirm-payment-btn'));
    expect(onConfirmCheckout).toHaveBeenCalledWith({
      payment_method: 'CASH',
      cash_received: 100000,
    });
  });
});
