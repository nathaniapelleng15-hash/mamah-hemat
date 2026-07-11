-- ============================================================
--  MAMAH HEMAT CATERING — Database Schema MySQL
--  Versi: 1.0.0
--  Dibuat: 2026-07-07
-- ============================================================
-- Mencakup 3 modul admin:
--   1. Manajemen Produk (CRUD Produk & Add-ons)
--   2. Monitor Pesanan Masuk (Order Management)
--   3. Daftar Transaksi & Pembayaran
-- ============================================================

CREATE DATABASE IF NOT EXISTS mamah_hemat_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE mamah_hemat_db;

-- ============================================================
-- MODUL 1: MANAJEMEN PRODUK
-- ============================================================

-- Tabel: categories (Kategori Menu)
CREATE TABLE IF NOT EXISTS categories (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,               -- "Personal Box", "Family Sharing", "Big Event", "Dessert & Drink"
  slug        VARCHAR(120) NOT NULL UNIQUE,        -- "personal-box", "family-sharing"
  description TEXT,
  sort_order  TINYINT UNSIGNED DEFAULT 0,          -- urutan tampil di frontend
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Tabel: products (Menu / Produk Catering)
CREATE TABLE IF NOT EXISTS products (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id   INT UNSIGNED NOT NULL,
  sku           VARCHAR(50) UNIQUE,                       -- kode produk internal, misal: "MH-001"
  name          VARCHAR(200) NOT NULL,                    -- "Nasi Tumpeng Mini Sasmita"
  slug          VARCHAR(220) NOT NULL UNIQUE,             -- "nasi-tumpeng-mini-sasmita"
  description   TEXT,                                     -- deskripsi panjang
  price         DECIMAL(12,2) NOT NULL DEFAULT 0,         -- harga satuan (Rupiah)
  pax_info      VARCHAR(100),                             -- "1 Pax (Sangat Kenyang)"
  tag           VARCHAR(100),                             -- "Best Seller", "Premium Choice"
  image_url     VARCHAR(500),                             -- URL gambar produk
  stock_qty     INT UNSIGNED NOT NULL DEFAULT 100,        -- ⭐ Stok tersedia (porsi/unit)
  stock_status  ENUM('available','out_of_stock','hidden') NOT NULL DEFAULT 'available',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  sort_order    SMALLINT UNSIGNED DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================
-- SISTEM RESERVASI STOK (ANTI-OVERSELLING)
-- ============================================================

-- Tabel: stock_reservations
-- Menyimpan "kunci stok" sementara selama pembayaran berlangsung.
-- Stok tersedia dihitung:  available = stock_qty - SUM(pending reservations yang belum expire)
-- Reservasi dihapus otomatis ketika:
--   a. Pembayaran sukses (webhook) → status jadi 'confirmed'
--   b. Pembayaran timeout/gagal    → cron job delete reservasi
CREATE TABLE IF NOT EXISTS stock_reservations (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id    INT UNSIGNED NOT NULL,
  product_id  INT UNSIGNED NOT NULL,
  quantity    SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  status      ENUM('pending','confirmed','released') NOT NULL DEFAULT 'pending',
  expires_at  DATETIME NOT NULL,                         -- kapan reservasi kadaluarsa
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Index kritis untuk performa SELECT FOR UPDATE saat checkout
  INDEX idx_reservation_product_status (product_id, status, expires_at),
  INDEX idx_reservation_order          (order_id),
  INDEX idx_reservation_expires        (status, expires_at),  -- untuk cron cleanup

  CONSTRAINT fk_reservation_order   FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  CONSTRAINT fk_reservation_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- Tabel: addons (Add-on / Pelengkap Pesanan)
CREATE TABLE IF NOT EXISTS addons (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,                  -- "Extra Ice Gel Pack"
  description TEXT,
  price       DECIMAL(10,2) NOT NULL DEFAULT 0,
  badge       VARCHAR(100),                           -- "Dingin", "Luxury Wrap"
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  sort_order  SMALLINT UNSIGNED DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- MODUL 2: PESANAN (ORDER MANAGEMENT)
-- ============================================================

-- Tabel: customers (Data Pemesan)
CREATE TABLE IF NOT EXISTS customers (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(200) NOT NULL,                -- nama lengkap pemesan
  phone        VARCHAR(20)  NOT NULL,                -- nomor WhatsApp
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (phone)
) ENGINE=InnoDB;

-- Tabel: orders (Pesanan Utama)
CREATE TABLE IF NOT EXISTS orders (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number       VARCHAR(30) NOT NULL UNIQUE,    -- "MH-202507-1234"
  customer_id        INT UNSIGNED NOT NULL,
  delivery_method    ENUM('pickup', 'delivery') NOT NULL DEFAULT 'pickup', -- ⭐ pickup / delivery
  delivery_address   TEXT DEFAULT NULL,                                    -- ⭐ alamat lengkap jika delivery
  delivery_fee       DECIMAL(12,2) NOT NULL DEFAULT 0.00,                  -- ⭐ ongkir flat
  delivery_date      DATE DEFAULT NULL,                                    -- tanggal antar (opsional jika request admin)
  delivery_time      TIME DEFAULT NULL,                                    -- jam antar (opsional jika request admin)
  notes              TEXT,                           -- catatan tambahan dari customer
  subtotal           DECIMAL(12,2) NOT NULL DEFAULT 0,
  addons_total       DECIMAL(12,2) NOT NULL DEFAULT 0,
  grand_total        DECIMAL(12,2) NOT NULL DEFAULT 0,
  order_status       ENUM(
                       'pending',       -- baru masuk, belum dikonfirmasi
                       'confirmed',     -- dikonfirmasi admin
                       'preparing',     -- sedang dimasak
                       'ready',         -- siap kirim
                       'delivered',     -- sudah diantar
                       'cancelled'      -- dibatalkan
                     ) NOT NULL DEFAULT 'pending',
  admin_notes        TEXT,                           -- catatan internal admin
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  INDEX idx_order_status  (order_status)
) ENGINE=InnoDB;

-- Tabel: order_items (Rincian Item dalam Pesanan)
CREATE TABLE IF NOT EXISTS order_items (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id     INT UNSIGNED NOT NULL,
  product_id   INT UNSIGNED NOT NULL,
  product_name VARCHAR(200) NOT NULL,           -- snapshot nama saat order (antisipasi perubahan harga)
  unit_price   DECIMAL(12,2) NOT NULL,          -- snapshot harga saat order
  quantity     SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  subtotal     DECIMAL(12,2) NOT NULL,          -- unit_price * quantity
  CONSTRAINT fk_order_item_order   FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  CONSTRAINT fk_order_item_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_order_items_order (order_id)
) ENGINE=InnoDB;

-- Tabel: order_addons (Add-on yang dipilih dalam pesanan)
CREATE TABLE IF NOT EXISTS order_addons (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id    INT UNSIGNED NOT NULL,
  addon_id    INT UNSIGNED NOT NULL,
  addon_name  VARCHAR(200) NOT NULL,            -- snapshot nama add-on saat order
  price       DECIMAL(10,2) NOT NULL,           -- snapshot harga add-on saat order
  CONSTRAINT fk_order_addon_order FOREIGN KEY (order_id) REFERENCES orders(id)  ON DELETE CASCADE,
  CONSTRAINT fk_order_addon_addon FOREIGN KEY (addon_id) REFERENCES addons(id)  ON DELETE RESTRICT,
  UNIQUE KEY uq_order_addon (order_id, addon_id)
) ENGINE=InnoDB;

-- ============================================================
-- MODUL 3: TRANSAKSI & PEMBAYARAN
-- ============================================================

-- Tabel: transactions (Riwayat Pembayaran)
CREATE TABLE IF NOT EXISTS transactions (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id            INT UNSIGNED NOT NULL,
  transaction_number  VARCHAR(50) NOT NULL UNIQUE,    -- "TXN-MH-202507-1234"
  payment_method      ENUM(
                        'transfer_bca',
                        'transfer_mandiri',
                        'transfer_bni',
                        'transfer_bri',
                        'qris',
                        'cash',
                        'other'
                      ) NOT NULL DEFAULT 'transfer_bca',
  payment_status      ENUM(
                        'pending',    -- menunggu pembayaran
                        'processing', -- sedang diverifikasi
                        'paid',       -- lunas / berhasil
                        'failed',     -- gagal
                        'refunded'    -- dikembalikan
                      ) NOT NULL DEFAULT 'pending',
  amount              DECIMAL(12,2) NOT NULL,          -- jumlah yang harus dibayar
  amount_paid         DECIMAL(12,2) DEFAULT NULL,      -- jumlah aktual yang diterima
  payment_proof_url   VARCHAR(500)  DEFAULT NULL,      -- URL foto bukti transfer
  gateway_ref         VARCHAR(200)  DEFAULT NULL,      -- referensi payment gateway (Xendit/Midtrans)
  gateway_response    JSON          DEFAULT NULL,      -- raw response dari gateway
  paid_at             DATETIME      DEFAULT NULL,      -- waktu pembayaran dikonfirmasi
  expired_at          DATETIME      DEFAULT NULL,      -- batas waktu bayar (+15 menit dari order)
  notes               TEXT          DEFAULT NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_transaction_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  INDEX idx_transaction_status (payment_status),
  INDEX idx_transaction_date   (created_at)
) ENGINE=InnoDB;

-- Tabel: admin_users (Akun Admin Panel)
CREATE TABLE IF NOT EXISTS admin_users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  email         VARCHAR(200) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,           -- bcrypt hash
  role          ENUM('super_admin','admin','staff') NOT NULL DEFAULT 'staff',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME DEFAULT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- DATA AWAL (SEED DATA)
-- ============================================================

-- Seed: Categories
INSERT INTO categories (name, slug, description, sort_order) VALUES
  ('Personal Box',    'personal-box',    'Paket nasi box untuk 1 orang',        1),
  ('Family Sharing',  'family-sharing',  'Paket untuk keluarga 2-3 orang',      2),
  ('Big Event',       'big-event',       'Paket untuk acara besar 10+ orang',   3),
  ('Dessert & Drink', 'dessert-drink',   'Minuman dan dessert pelengkap',        4);

-- Seed: Products
INSERT INTO products (category_id, sku, name, slug, description, price, pax_info, tag, image_url) VALUES
  (1, 'MH-001', 'Nasi Tumpeng Mini Sasmita', 'nasi-tumpeng-mini-sasmita',
   'Nasi kuning wangi bumbu rempah pilihan, disajikan dengan ayam goreng krispi, sambal goreng ati kentang, abon sapi premium, telur dadar iris, perkedel kentang, dan lalapan segar.',
   45000, '1 Pax (Sangat Kenyang)', 'Best Seller',
   'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=600&q=80'),

  (1, 'MH-002', 'Bento Box Kencana Wagyu', 'bento-box-kencana-wagyu',
   'Nasi melati wangi dipadukan dengan Rendang Daging Wagyu legendaris yang empuk meresap, tumis buncis bawang putih, telur asin premium, bakwan jagung krispi, dan sambal embe Bali.',
   65000, '1 Pax (Sangat Mewah)', 'Premium Choice',
   'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=600&q=80'),

  (2, 'MH-003', 'Rantang Royal Amartha (2-3 Pax)', 'rantang-royal-amartha',
   'Set lauk catering mewah ramah keluarga berisikan: Ayam Bakar Madu aroma kemangi, Empal Geprek serundeng, Capcay Bakso Udang kuah kental, Sambal Terasi Mamah, dan kerupuk udang renyah.',
   135000, '2 - 3 Pax (Sempurna)', 'Signature Dish',
   'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80'),

  (3, 'MH-004', 'Tumpeng Ayu Kencana (10 Pax)', 'tumpeng-ayu-kencana',
   'Karya seni kuliner tumpeng hias ukuran besar untuk perayaan istimewa. Lengkap dengan Ayam Panggang Bekakak, Daging Rendang Padang, Sambal Goreng Udang Pete, Sate Lilit Bali, Urap Sayur Segar.',
   480000, '10 Pax (Pesta & Syukuran)', 'Party Highlight',
   'https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=600&q=80'),

  (4, 'MH-005', 'Es Selendang Mayang Ningrat', 'es-selendang-mayang-ningrat',
   'Hidangan penutup manis khas legendaris. Kue selendang mayang bertekstur lembut kenyal, dipadu kuah santan gurih perasan pertama, gula aren murni pekat wangi pandan asli, dan es batu segar.',
   25000, 'Gelas Premium (Dingin)', 'Refreshing',
   'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=600&q=80');

-- Seed: Add-ons
INSERT INTO addons (name, description, price, badge, sort_order) VALUES
  ('Extra Ice Gel Pack',
   'Pengaman suhu ekstra agar pesanan tetap segar selama perjalanan jauh.',
   5000, 'Dingin', 1),
  ('Tas Hantaran Batik Kencana',
   'Tas spunbond batik premium berpita emas mewah. Sangat cocok sebagai hantaran / hadiah.',
   15000, 'Luxury Wrap', 2),
  ('Sendok Bebek & Garpu Set (5 pasang)',
   'Sendok dan garpu tebal ramah lingkungan dilengkapi tisu basah steril.',
   3000, 'Eco-Friendly', 3);

-- Seed: Admin User (password: "admin123" — ganti setelah deploy!)
INSERT INTO admin_users (name, email, password_hash, role) VALUES
  ('Super Admin', 'admin@mamahhemat.com',
   '$2b$12$PLACEHOLDER_HASH_GANTI_DENGAN_BCRYPT_ADMIN123', 'super_admin');
