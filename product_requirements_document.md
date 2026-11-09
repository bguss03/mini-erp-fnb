****
Berperanlah sebagai Senior Fullstack Web Developer. Gunakan dokumen PRD di bawah ini sebagai konteks dan panduan utama untuk setiap tugas pengembangan (database, backend, frontend, maupun testing) yang akan dikerjakan.

---

# Product Requirements Document (PRD): Mini ERP F&B (Point of Sales, Inventory, & HR)

## 1. Ringkasan Produk (Product Overview)

* **Nama Proyek:** Mini ERP F&B

* **Latar Belakang:** Operasional outlet F&B berskala menengah sering kali menghadapi masalah selisih kas pada akhir *shift* dan ketidaksinkronan antara barang terjual dengan sisa stok bahan baku di dapur. Pencatatan manual membuat rekonsiliasi menjadi lambat dan rawan *human error*.

* **Tujuan Produk:** Membangun sistem Point of Sales (POS) terpusat yang tidak hanya mencatat penjualan, tetapi secara otomatis mengelola pemotongan stok bahan baku berdasarkan resep (Bill of Materials) dan mencatat rekonsiliasi kas kasir secara *real-time*.

## 2. Spesifikasi Teknis & Desain (Technical & Design Specs)

* **Frontend:** React.js (menggunakan Vite dan TypeScript untuk skalabilitas).

* **Backend:** Golang (Untuk menangani konkurensi transaksi dan *real-time updates*).

* **Database:** PostgreSQL (Mendukung transaksi ACID yang krusial untuk sinkronisasi inventaris dan kas).

* **Color Palette UI:**

  * **Primary:** `#FC6C01` (Oranye) - Digunakan untuk tombol utama (Call to Action seperti "Bayar", "Simpan", "Buka Shift"), aksen indikator aktif, dan logo.

  * **Background/Neutral:** `#FFFFFF` (Putih) - Digunakan sebagai warna dominan latar belakang, kartu (*cards*), dan kontainer panel untuk memberikan kontras yang bersih dan modern. Teks menggunakan variasi abu-abu gelap/hitam murni demi keterbacaan di atas warna putih.

## 3. Target Pengguna (User Personas)

1. **Kasir:** Membuka/menutup *shift* harian, memasukkan pesanan pelanggan, dan memproses pembayaran.

2. **Manajer/Admin:** Menambahkan menu baru, mengatur resep bahan baku, dan memantau laporan rekonsiliasi penjualan harian.

## 4. Kebutuhan Fitur (Functional Requirements)

### Modul 1: Point of Sales (POS)

* **Keranjang Pesanan (Cart):** Pengguna dapat menambahkan produk (menu) ke dalam keranjang, menyesuaikan jumlah (qty), dan menghapus *item*.

* **Kalkulasi Transaksi:** Sistem otomatis menghitung *Subtotal*, *Tax* (contoh: PB1 10%), dan *Grand Total*.

* **Checkout & State Machine:**

  * Transaksi disimpan dengan status `PAID`.

  * Saat transaksi berhasil, sistem harus mengirimkan *request* ke layanan Inventory untuk melakukan deduksi stok.

### Modul 2: Inventory & Recipe Management (BOM)

* **Master Data Bahan Baku (Raw Materials):** Admin dapat mencatat stok fisik bahan baku (misal: Beras - Gram, Daun Pisang - Lembar).

* **Manajemen Resep (Recipe Linkage):** Setiap menu (Product) dikaitkan dengan satu atau lebih bahan baku (misal: 1 porsi Nasi Bakar = 150g Beras, 1 Lembar Daun Pisang).

* **Automated Stock Deduction:** Begitu transaksi di modul POS berstatus `PAID`, stok bahan baku terpotong secara atomik (*Database Transaction*).

* **Low Stock Alert:** Sistem menampilkan peringatan UI visual berwarna `#FC6C01` jika stok suatu bahan baku berada di bawah ambang batas minimal.

### Modul 3: HR & Cash Management (Rekonsiliasi Shift)

* **Clock-in Shift (Buka Kasir):** Saat login, kasir diwajibkan memasukkan angka "Saldo Awal Kasir" (uang modal kembalian).

* **Clock-out Shift (Tutup Kasir):** Di akhir pekerjaan, sistem menghitung Saldo Awal + Total Penjualan Tunai = *Expected Cash*. Kasir harus menginput hitungan uang fisik secara manual.

* **Discrepancy Report:** Sistem mencatat selisih (*variance*) jika ada perbedaan antara hitungan sistem dan fisik.

## 5. Kebutuhan Non-Fungsional (Non-Functional Requirements)

* **ACID Compliance:** Backend Golang dan PostgreSQL **wajib** menggunakan *Database Transactions*. Jika terjadi *error* saat memotong stok bahan baku, maka pencatatan penjualan harus dibatalkan (*Rollback*) agar data tidak *corrupt*.

* **Performance:** Respon API untuk menambah item ke keranjang dan *checkout* harus berada di bawah 200ms untuk menunjang kecepatan pelayanan kasir.

* **UI Responsiveness:** Antarmuka React.js harus dioptimalkan untuk orientasi *landscape* (seperti tampilan tablet POS di meja kasir).

## 6. Strategi Pengujian (Testing Strategy)

* **Unit Testing (Golang):** Menguji fungsi kalkulasi harga total, penerapan pajak, dan penghitungan potongan stok tanpa menyentuh *database* secara langsung.

* **Integration Testing:** Memastikan transaksi pembelian berhasil melakukan deduksi ke beberapa entitas bahan baku secara serentak di tabel PostgreSQL.

* **Frontend Component Testing (React):** Memastikan komponen keranjang, modal pembayaran, dan peringatan *Low Stock* ter-render dengan benar sesuai *state* pesanan.

## 7. Fase Pengembangan (Milestones)

* **Fase 1 (Database & Core API):** Setup PostgreSQL skema, pembuatan API CRUD master menu dan bahan baku menggunakan Golang.

* **Fase 2 (Frontend Boilerplate & UI):** Inisialisasi React.js, implementasi desain dengan palet `#FC6C01` dan `#FFFFFF`, pembuatan komponen dasar (tombol, tabel, *card* menu).

* **Fase 3 (Transaction Logic):** Integrasi API kasir, perhitungan matematis transaksi, dan logika deduksi stok otomatis.

* **Fase 4 (Shift Management & Testing):** Fitur buka/tutup *shift*, finalisasi perhitungan rekonsiliasi kas, dan penulisan Unit Test.
