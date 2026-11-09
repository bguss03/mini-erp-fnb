# Mini ERP F&B (Point of Sales, Inventory BOM, & HR Cash Management)

Sistem **Enterprise Resource Planning (ERP) F&B** terintegrasi yang dirancang untuk mengatasi masalah selisih kas pada akhir *shift* kasir dan ketidaksinkronan antara barang terjual dengan sisa fisik bahan baku di dapur (*Bill of Materials*).

Aplikasi ini mengimplementasikan **Database Transactions (ACID Compliance)** di level backend Golang dan PostgreSQL untuk memastikan deduksi stok bahan baku selalu konsisten dan atomik secara *real-time*.

---

## 📑 Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Teknologi yang Digunakan](#-teknologi-yang-digunakan)
- [Palet Warna Desain](#-palet-warna-desain)
- [Struktur Direktori](#-struktur-direktori)
- [Panduan Menjalankan Proyek (Docker)](#-panduan-menjalankan-proyek-docker)
- [Akses Layanan](#-akses-layanan)
- [Pengujian (Testing Strategy)](#-pengujian-testing-strategy)
- [Dokumentasi REST API](#-dokumentasi-rest-api)
- [Skema Database & Resep BOM](#-skema-database--resep-bom)

---

## 🚀 Fitur Utama

### 1. Modul Point of Sales (POS)
- **Katalog Menu & Kategori:** Mendukung pencarian menu, filter kategori (*Makanan, Minuman, Snack*), serta indikator porsi yang dapat disajikan berdasarkan ketersediaan bahan baku.
- **Keranjang Pesanan (Cart):** Penyesuaian jumlah (qty), validasi stok maksimum, hapus item, dan opsi pesanan (*Dine In* / *Take Away*).
- **Kalkulasi Transaksi Otomatis:** Menghitung *Subtotal*, Pajak Restoran (*PB1 10%*), dan *Grand Total* secara presisi.
- **Multi Metode Pembayaran:** Tunai (*CASH* dengan kalkulasi uang kembalian dan tombol nominal cepat), *QRIS*, dan *Kartu Debit*.
- **Tampilan Responsif:** Dioptimalkan untuk orientasi *landscape* tablet kasir dan layar *smartphone* (dilengkapi *Bottom Navigation Bar* & *Slide-Up Floating Cart Sheet*).

### 2. Modul Inventory & Recipe Management (Bill of Materials / BOM)
- **Master Data Bahan Baku:** Manajemen stok bahan baku fisik (misal: Beras - Gram, Daun Pisang - Lembar, Kopi - Gram, Susu - ml).
- **Recipe Linkage (BOM):** Setiap menu dikaitkan dengan satu atau lebih bahan baku per porsinya.
- **Automated Stock Deduction (ACID):** Pemotongan stok bahan baku dilakukan secara atomik menggunakan *Database Transaction* (`BEGIN` ... `SELECT ... FOR UPDATE` ... `COMMIT`). Jika stok tidak mencukupi, transaksi dibatalkan (*Rollback*) sehingga data tidak *corrupt*.
- **Low Stock Alert (`#FC6C01`):** Peringatan visual otomatis jika sisa stok suatu bahan berada pada atau di bawah ambang batas minimal (`min_stock`).
- **Audit Log Mutasi Stok:** Pencatatan otomatis setiap mutasi (*Sale Deduction, Restock, Adjustment*).

### 3. Modul HR & Cash Management (Rekonsiliasi Shift Kasir)
- **Clock-in Shift (Buka Kasir):** Kasir wajib menginput Saldo Awal (*modal uang kembalian*) sebelum memulai transaksi.
- **Kalkulasi Expected Cash:** Sistem menghitung otomatis:
  $$\text{Expected Cash} = \text{Saldo Awal} + \text{Total Penjualan Tunai}$$
- **Clock-out Shift (Tutup Kasir):** Kasir menginput hitungan uang fisik secara manual (*Actual Cash*).
- **Discrepancy & Variance Report:** Mencatat dan mengkategorikan selisih kas:
  - `MATCH`: Uang fisik pas dengan hitungan sistem ($\text{Variance} = 0$).
  - `SHORTAGE`: Kas fisik kurang / defisit ($\text{Variance} < 0$).
  - `OVERAGE`: Kas fisik lebih / surplus ($\text{Variance} > 0$).

---

## 🛠️ Teknologi yang Digunakan

| Komponen | Teknologi | Keterangan |
| :--- | :--- | :--- |
| **Frontend** | React.js 18, TypeScript, Vite | UI responsif (*Tablet Landscape & Mobile*) |
| **Styling** | Tailwind CSS | Utility-first CSS & Palet Warna Spesifik |
| **Backend** | Golang 1.23 | REST API performa tinggi (<200ms) & ACID Transaction |
| **Database** | PostgreSQL 16 | Relational DB dengan constraint dan transaksi ACID |
| **Database GUI** | Adminer | Manajemen database berbasis web via browser |
| **Container** | Docker & Docker Compose | Multi-container orchestration terisolasi |
| **Unit Testing** | Go `testing`, Vitest, React Testing Library | Pengujian backend & komponen frontend |

---

## 🎨 Palet Warna Desain

Sesuai spesifikasi PRD:
- **Primary Accent (`#FC6C01` - Oranye):** Tombol Call to Action (*Bayar*, *Simpan*, *Buka Shift*), aksen menu aktif, dan badge *Low Stock Alert*.
- **Background / Neutral (`#FFFFFF` - Putih):** Warna latar belakang dominan, panel kartu (*cards*), dan kontainer untuk kontras bersih dan modern dengan teks kontras tinggi.

---

## 📁 Struktur Direktori

```text
mini-erp-fnb/
├── docker-compose.yml              # Konfigurasi container Docker (PostgreSQL, Backend, Frontend, Adminer)
├── product_requirements_document.md # Dokumen Spesifikasi Kebutuhan Produk (PRD)
├── README.md                       # Dokumentasi utama proyek
│
├── database/
│   └── init.sql                    # Skema DDL tabel & data seed awal F&B
│
├── backend/
│   ├── cmd/server/
│   │   └── main.go                 # Entrypoint server Golang
│   ├── internal/
│   │   ├── api/
│   │   │   └── server.go           # REST API router & HTTP handlers
│   │   ├── domain/
│   │   │   ├── models.go           # Struct data model (Product, Shift, BOM, dll.)
│   │   │   ├── calculator.go       # Pure business logic (Kalkulasi POS, BOM, Shift)
│   │   │   └── calculator_test.go  # Unit testing Golang
│   │   └── store/
│   │       ├── store.go            # SQL Database transaction logic (ACID)
│   │       └── store_integration_test.go # Integration test Go + PostgreSQL
│   ├── Dockerfile
│   ├── go.mod
│   └── go.sum
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── PosCartPanel.tsx    # Komponen keranjang belanja & kalkulasi POS
    │   │   ├── CheckoutModal.tsx   # Modal pembayaran kasir & kembalian
    │   │   ├── InventoryModule.tsx # Manajemen bahan baku, resep BOM, & mutasi stok
    │   │   ├── ShiftModule.tsx     # Buka/tutup shift & laporan rekonsiliasi kas
    │   │   └── LowStockAlert.tsx   # Banner peringatan stok menipis (#FC6C01)
    │   ├── services/
    │   │   └── api.ts              # Client API Fetch wrapper
    │   ├── types/
    │   │   └── erp.ts              # TypeScript interfaces & helper fungsi
    │   ├── __tests__/
    │   │   └── pos_components.test.tsx # Component testing Vitest
    │   ├── App.tsx                 # Layout utama responsif (Landscape & Mobile)
    │   ├── main.tsx
    │   └── index.css
    ├── Dockerfile
    ├── package.json
    ├── tailwind.config.js
    └── vite.config.ts
```

---

## 🐳 Panduan Menjalankan Proyek (Docker)

Pastikan **Docker Desktop** sudah berjalan di komputer Anda.

### 1. Jalankan Seluruh Aplikasi
Cukup jalankan satu perintah berikut di root folder proyek:
```bash
docker compose up -d --build
```

Perintah ini akan secara otomatis:
1. Menjalankan **PostgreSQL 16** dan mengeksekusi skema + *seed data* awal (`database/init.sql`).
2. Melakukan *build* dan menjalankan kontainer **Backend Golang** di port `8080`.
3. Menjalankan kontainer **Frontend React** di port `5173`.
4. Menjalankan web database **Adminer** di port `8081`.

### 2. Memeriksa Status Kontainer
```bash
docker compose ps
```

### 3. Menghentikan Kontainer
```bash
docker compose down
```

---

## 🌐 Akses Layanan

| Layanan | URL | Keterangan |
| :--- | :--- | :--- |
| **Frontend Web POS** | [http://localhost:5173](http://localhost:5173) | Aplikasi kasir, inventaris, dan shift |
| **Backend REST API** | [http://localhost:8080/api/health](http://localhost:8080/api/health) | Endpoint API Golang |
| **Database GUI (Adminer)** | [http://localhost:8081](http://localhost:8081) | Web client database PostgreSQL |
| **Database Langsung** | `localhost:5432` | Koneksi untuk DBeaver / TablePlus / `psql` |

### Informasi Login Adminer / Database:
- **System:** `PostgreSQL`
- **Server:** `postgres` *(jika login via Adminer) atau `localhost` (jika dari DBeaver/TablePlus)*
- **Username:** `postgres`
- **Password:** `postgres`
- **Database:** `mini_erp_fnb`

---

## 🧪 Pengujian (Testing Strategy)

Proyek ini telah dilengkapi dengan strategi pengujian berlapis sesuai panduan PRD:

### 1. Unit Testing (Golang)
Menguji logika kalkulasi transaksi, pajak PB1 10%, rekonsiliasi kas shift, dan kalkulasi kebutuhan bahan baku resep BOM tanpa menyentuh database:
```bash
cd backend
go test ./internal/domain -v
```

### 2. Integration Testing (Golang + PostgreSQL)
Menguji pemotongan stok bahan baku secara atomik (*Database Transaction*) dan memvalidasi mekanisme *Rollback* saat ada bahan baku yang kurang:
```bash
cd backend
go test ./internal/store -v
```

### 3. Frontend Component Testing (React + Vitest)
Menguji komponen keranjang pesanan, modal pembayaran kasir, serta peringatan *Low Stock Alert*:
```bash
cd frontend
npm test
```

---

## 📡 Dokumentasi REST API

### 1. Health & Dashboard
- `GET /api/health` — Status kesehatan server
- `GET /api/dashboard` — Ringkasan omset harian, jumlah pesanan, dan daftar bahan baku *low stock*

### 2. Inventory & Bahan Baku
- `GET /api/raw-materials` — Daftar semua bahan baku fisik beserta status stok
- `POST /api/raw-materials` — Menambah bahan baku baru
- `PUT /api/raw-materials/{id}` — Mengubah data bahan baku
- `POST /api/raw-materials/{id}/adjust` — Melakukan restock atau penyesuaian stok manual
- `DELETE /api/raw-materials/{id}` — Menghapus bahan baku
- `GET /api/stock-movements` — Riwayat log mutasi stok otomatis

### 3. Master Menu & Resep (BOM)
- `GET /api/products` — Daftar menu beserta resep bahan baku dan sisa porsi maksimal
- `GET /api/products/{id}` — Detail menu
- `POST /api/products` — Menambah menu baru beserta resep bahan bakunya
- `PUT /api/products/{id}` — Memperbarui menu, harga jual, dan resep BOM
- `DELETE /api/products/{id}` — Menghapus menu

### 4. Transaksi Kasir (POS)
- `POST /api/pos/calculate` — Menghitung subtotal, PB1 10%, dan grand total pesanan
- `POST /api/transactions` — Melakukan *checkout* pembayaran (`PAID`) dan memotong stok bahan baku secara atomik
- `GET /api/transactions` — Riwayat transaksi penjualan

### 5. Manajemen Shift Kasir
- `GET /api/shifts/active` — Mengambil data shift kasir yang sedang aktif (*OPEN*)
- `GET /api/shifts` — Riwayat laporan rekonsiliasi shift
- `POST /api/shifts/open` — Membuka shift baru dengan Saldo Awal modal kasir
- `POST /api/shifts/{id}/close` — Menutup shift, menghitung *Expected Cash*, dan mencatat *Variance* uang fisik

---

## 🍽️ Skema Database & Resep BOM

### Contoh Keterkaitan Resep Bahan Baku (*Bill of Materials*):
1. **Nasi Bakar Ayam Kemangi (Rp 28.000)**
   - 150g Beras Pandan Wangi
   - 1 Lembar Daun Pisang
   - 80g Ayam Suwir Bumbu Kemangi
2. **Rice Bowl Beef Teriyaki + Telur (Rp 38.000)**
   - 150g Beras Pandan Wangi
   - 100g Daging Sapi Slice
   - 1 Butir Telur Ayam Negeri
3. **Es Kopi Susu Gula Aren (Rp 22.000)**
   - 18g Biji Kopi Arabika Espresso
   - 150ml Susu Fresh Milk
   - 25ml Gula Aren Cair

*Ketika pelanggan membeli 2 porsi Nasi Bakar Ayam Kemangi, sistem secara atomik memotong 300g Beras, 2 Lembar Daun Pisang, dan 160g Ayam Suwir sekaligus dalam satu transaksi database.*
