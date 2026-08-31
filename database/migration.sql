-- ============================================================
-- SQL MIGRATION FOR PHPMYADMIN (MAMAH HEMAT)
-- Copy-paste query di bawah ini ke tab "SQL" di phpMyAdmin Anda
-- ============================================================

USE mamah_hemat_db;

-- 1. stock_qty and 2. stock_reservations are already created in schema.sql. Skipping.

-- ============================================================
-- MIGRATION v2: Area Pengantaran Dinamis + Kolom Orders
-- Jalankan query ini jika DB sudah ada (update dari versi lama)
-- ============================================================

-- 3. Buat tabel delivery_areas (pengganti DELIVERY_AREAS hardcode di frontend)
CREATE TABLE IF NOT EXISTS delivery_areas (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  label      VARCHAR(200) NOT NULL,            -- "Panorama Sepatan 1", "Kedaung", dll
  fee        DECIMAL(10,2) NOT NULL DEFAULT 0, -- ongkir dalam Rupiah (0 = gratis)
  is_active  TINYINT(1) NOT NULL DEFAULT 1,    -- 1=aktif tampil di katalog, 0=nonaktif
  sort_order SMALLINT UNSIGNED DEFAULT 0,      -- urutan tampil
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Seed data: area pengantaran yang sebelumnya hardcode di App.tsx
INSERT INTO delivery_areas (label, fee, sort_order) VALUES
  ('Panorama Sepatan 1',               0,      1),
  ('Panorama Sepatan 2',               0,      2),
  ('Panorama Sepatan 3',               0,      3),
  ('Duta Asri Palem 1',                0,      4),
  ('Duta Asri Palem 7',                0,      5),
  ('Sepatan City',                     0,      6),
  ('Area Jl. Gatot Subroto',           0,      7),
  ('Kedaung',                          5000,   8),
  ('Puri Angkasa',                     5000,   9),
  ('Palem City',                       5000,  10),
  ('Jati Mulya Residence',             5000,  11),
  ('Samawa Village',                   5000,  12),
  ('Banyu Biru',                       5000,  13),
  ('Grand City',                       5000,  14),
  ('Magnolia',                         5000,  15),
  ('Pesona Lebak Wangi',               5000,  16),
  ('Imperial',                        10000,  17),
  ('Paradise',                        10000,  18),
  ('Sulang',                          10000,  19),
  ('Sepatan',                         10000,  20),
  ('Golden City',                     10000,  21),
  ('Paku Haji - Palem 5',             10000,  22),
  ('Sekitarnya (area lain terdekat)', 10000,  23);

-- 4. Kolom orders yang sudah ditambahkan user — jalankan hanya jika belum ada
--    (phpMyAdmin akan error jika kolom sudah ada, abaikan saja error tersebut)
ALTER TABLE orders
  ADD COLUMN delivery_area_id    INT(11)       DEFAULT NULL AFTER delivery_method,
  ADD COLUMN delivery_area_label VARCHAR(255)  DEFAULT NULL AFTER delivery_area_id,
  ADD COLUMN delivery_area       VARCHAR(255)  DEFAULT NULL AFTER delivery_area_label,
  ADD COLUMN delivery_map_link   VARCHAR(500)  DEFAULT NULL AFTER delivery_address;
