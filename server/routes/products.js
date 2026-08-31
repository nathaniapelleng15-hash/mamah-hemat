// routes/products.js — CRUD API untuk Produk, Add-ons, dan Kategori
const express = require('express');
const router = express.Router();
const db = require('../db');
const upload = require('../middleware/upload');
const path = require('path');
const { requireAdminAuth } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────
// 1. GET /api/products  —  PUBLIC, dipakai katalog pelanggan
//    TIDAK boleh pakai requireAdminAuth di sini
// ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    // Ambil Kategori
    const [categories] = await db.query(
      'SELECT id, name, slug, description, sort_order FROM categories ORDER BY sort_order ASC'
    );

    // Ambil Produk (dengan join kategori untuk nama kategori)
    const [products] = await db.query(
      `SELECT p.id, p.category_id, c.name as category_name, p.sku, p.name, p.slug,
              p.description, p.price, p.pax_info, p.tag, p.image_url, p.stock_qty,
              p.stock_status, p.is_active, p.sort_order
       FROM products p
       JOIN categories c ON c.id = p.category_id
       ORDER BY p.sort_order ASC, p.id DESC`
    );

    // Ambil Add-ons
    const [addons] = await db.query(
      'SELECT id, name, description, price, badge, is_active, sort_order FROM addons ORDER BY sort_order ASC'
    );

    res.json({
      categories,
      products,
      addons
    });
  } catch (err) {
    console.error('[API/products] Error fetching data:', err);
    res.status(500).json({ error: 'Gagal mengambil data produk dari database.' });
  }
});

// ─────────────────────────────────────────────────────────
// 🔒 Mulai dari sini ke bawah, SEMUA route wajib login admin
// ─────────────────────────────────────────────────────────
router.use(requireAdminAuth);

// ─────────────────────────────────────────────────────────
// 2. CRUD KATEGORI (Untuk Tab Kategori di Admin)
// ─────────────────────────────────────────────────────────
router.post('/categories', async (req, res) => {
  const { name, description, sort_order } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Nama kategori wajib diisi.' });
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  try {
    const [result] = await db.query(
      'INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)',
      [name, slug, description || '', sort_order ?? 0]
    );
    res.status(201).json({ message: 'Kategori berhasil ditambahkan', categoryId: result.insertId });
  } catch (err) {
    console.error('[API/products/categories] Error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Nama/slug kategori sudah ada.' });
    }
    res.status(500).json({ error: 'Gagal menambahkan kategori.' });
  }
});

router.put('/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, sort_order } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Nama kategori wajib diisi.' });
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  try {
    await db.query(
      'UPDATE categories SET name = ?, slug = ?, description = ?, sort_order = ? WHERE id = ?',
      [name, slug, description || '', sort_order ?? 0, id]
    );
    res.json({ message: 'Kategori berhasil diupdate', categoryId: id });
  } catch (err) {
    console.error('[API/products/categories] Error:', err);
    res.status(500).json({ error: 'Gagal mengupdate kategori.' });
  }
});

router.delete('/categories/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Cegah hapus kategori yang masih dipakai produk (foreign key constraint)
    const [used] = await db.query('SELECT id FROM products WHERE category_id = ? LIMIT 1', [id]);
    if (used.length > 0) {
      return res.status(409).json({
        error: 'Kategori tidak bisa dihapus karena masih dipakai oleh produk. Pindahkan produknya dulu ke kategori lain.'
      });
    }

    await db.query('DELETE FROM categories WHERE id = ?', [id]);
    res.json({ message: 'Kategori berhasil dihapus' });
  } catch (err) {
    console.error('[API/products/categories] Error:', err);
    res.status(500).json({ error: 'Gagal menghapus kategori.' });
  }
});

// ─────────────────────────────────────────────────────────
// 3. POST /api/products
// Menambahkan produk baru ke database
// ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { category_id, sku, name, price, description, pax_info, tag, image_url, stock_qty, stock_status, is_active } = req.body;

  if (!category_id || !name || !price) {
    return res.status(400).json({ error: 'Kategori, Nama Produk, dan Harga wajib diisi.' });
  }

  // Generate slug otomatis dari nama produk
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  try {
    const [result] = await db.query(
      `INSERT INTO products 
         (category_id, sku, name, slug, description, price, pax_info, tag, image_url, stock_qty, stock_status, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [category_id, sku || null, name, slug, description || '', price, pax_info || '', tag || '', image_url || '', stock_qty || 100, stock_status || 'available', is_active !== undefined ? is_active : 1]
    );

    res.status(201).json({
      message: 'Produk berhasil ditambahkan',
      productId: result.insertId
    });
  } catch (err) {
    console.error('[API/products] Error creating product:', err);
    res.status(500).json({ error: 'Gagal menambahkan produk ke database.' });
  }
});

// ─────────────────────────────────────────────────────────
// 4. PUT /api/products/:id
// Mengupdate data produk yang sudah ada
// ─────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { category_id, sku, name, price, description, pax_info, tag, image_url, stock_qty, stock_status, is_active } = req.body;

  if (!category_id || !name || !price) {
    return res.status(400).json({ error: 'Kategori, Nama Produk, dan Harga wajib diisi.' });
  }

  // Generate slug otomatis dari nama produk
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  try {
    await db.query(
      `UPDATE products 
       SET category_id = ?, sku = ?, name = ?, slug = ?, description = ?, price = ?,
           pax_info = ?, tag = ?, image_url = ?, stock_qty = ?, stock_status = ?, is_active = ?
       WHERE id = ?`,
      [category_id, sku || null, name, slug, description || '', price, pax_info || '', tag || '', image_url || '', stock_qty || 0, stock_status || 'available', is_active !== undefined ? is_active : 1, id]
    );

    res.json({ message: 'Produk berhasil diupdate', productId: id });
  } catch (err) {
    console.error('[API/products] Error updating product:', err);
    res.status(500).json({ error: 'Gagal mengupdate produk di database.' });
  }
});

// ─────────────────────────────────────────────────────────
// 5. DELETE /api/products/:id
// Menghapus produk dari database
// ─────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { force } = req.query;

  try {
    // Cek apakah produk sedang digunakan di tabel order_items (mencegah foreign key error)
    const [orders] = await db.query('SELECT id FROM order_items WHERE product_id = ? LIMIT 1', [id]);
    if (orders.length > 0) {
      if (force === 'true') {
        // 1. Hapus reservasi stok terkait jika ada
        await db.query('DELETE FROM stock_reservations WHERE product_id = ?', [id]).catch(() => {});

        // 2. Coba set product_id = NULL di order_items agar data riwayat pesanan (nama, qty, harga) tetap tersimpan
        try {
          await db.query('ALTER TABLE order_items MODIFY product_id INT UNSIGNED NULL');
          await db.query('UPDATE order_items SET product_id = NULL WHERE product_id = ?', [id]);
        } catch (updateErr) {
          // Jika DB tidak mengizinkan NULL, hapus baris order_items terkait demi force delete
          await db.query('DELETE FROM order_items WHERE product_id = ?', [id]);
        }
      } else {
        return res.status(409).json({
          hasOrders: true,
          error: 'Produk tidak bisa dihapus karena sudah memiliki riwayat pesanan (order items).'
        });
      }
    }

    await db.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: 'Produk berhasil dihapus' });
  } catch (err) {
    console.error('[API/products] Error deleting product:', err);
    res.status(500).json({ error: 'Gagal menghapus produk dari database.' });
  }
});

// ─────────────────────────────────────────────────────────
// 6. CRUD ADD-ONS (Untuk Tab Addon di Admin)
// ─────────────────────────────────────────────────────────
router.post('/addons', async (req, res) => {
  const { name, description, price, badge, is_active } = req.body;
  if (!name || !price) {
    return res.status(400).json({ error: 'Nama Add-on dan harga wajib diisi.' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO addons (name, description, price, badge, is_active) VALUES (?, ?, ?, ?, ?)',
      [name, description || '', price, badge || '', is_active !== undefined ? is_active : 1]
    );
    res.status(201).json({ message: 'Add-on berhasil ditambahkan', addonId: result.insertId });
  } catch (err) {
    console.error('[API/products/addons] Error:', err);
    res.status(500).json({ error: 'Gagal menambahkan add-on.' });
  }
});

router.put('/addons/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, price, badge, is_active } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: 'Nama Add-on dan harga wajib diisi.' });
  }

  try {
    await db.query(
      'UPDATE addons SET name = ?, description = ?, price = ?, badge = ?, is_active = ? WHERE id = ?',
      [name, description || '', price, badge || '', is_active !== undefined ? is_active : 1, id]
    );
    res.json({ message: 'Add-on berhasil diupdate', addonId: id });
  } catch (err) {
    console.error('[API/products/addons] Error:', err);
    res.status(500).json({ error: 'Gagal mengupdate add-on.' });
  }
});

router.delete('/addons/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Cek di order_addons
    const [orders] = await db.query('SELECT id FROM order_addons WHERE addon_id = ? LIMIT 1', [id]);
    if (orders.length > 0) {
      return res.status(409).json({ error: 'Add-on tidak bisa dihapus karena sudah digunakan dalam pesanan.' });
    }

    await db.query('DELETE FROM addons WHERE id = ?', [id]);
    res.json({ message: 'Add-on berhasil dihapus' });
  } catch (err) {
    console.error('[API/products/addons] Error:', err);
    res.status(500).json({ error: 'Gagal menghapus add-on.' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/products/upload-image
// Upload gambar produk dari form file input
// Returns: { url: '/uploads/timestamp-filename.jpg' }
// ─────────────────────────────────────────────────────────
router.post('/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Tidak ada file yang diupload.' });
  }

  // URL publik yang bisa diakses oleh Vite frontend di localhost:3000
  const publicUrl = `/uploads/${req.file.filename}`;

  return res.status(201).json({
    url: publicUrl,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
  });
});

// Error handler khusus untuk multer (ukuran / format file)
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Ukuran file terlalu besar. Maksimal 5 MB.' });
  }
  if (err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;