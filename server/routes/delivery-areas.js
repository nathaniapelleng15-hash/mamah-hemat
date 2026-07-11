// routes/delivery-areas.js — CRUD Area Pengantaran & Ongkir
// ============================================================
// Endpoint:
//   GET    /api/delivery-areas          → publik (katalog frontend)
//   POST   /api/delivery-areas          → tambah area baru (admin)
//   PUT    /api/delivery-areas/:id      → edit area / fee / sort_order (admin)
//   PATCH  /api/delivery-areas/:id/toggle → toggle aktif/nonaktif (admin)
//   DELETE /api/delivery-areas/:id      → hapus area (admin)
// ============================================================
const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { requireAdminAuth } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────
// GET /api/delivery-areas  (PUBLIK — untuk dropdown di katalog)
// ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, label, fee, is_active, sort_order
       FROM delivery_areas
       ORDER BY sort_order ASC, id ASC`
    );
    res.json({ areas: rows.map(r => ({ ...r, fee: Number(r.fee) })) });
  } catch (err) {
    console.error('[delivery-areas] GET error:', err);
    res.status(500).json({ error: 'Gagal memuat daftar area pengantaran.' });
  }
});

// 🔒 Semua route di bawah ini wajib login admin
router.use(requireAdminAuth);

// ─────────────────────────────────────────────────────────
// POST /api/delivery-areas  — tambah area baru
// Body: { label, fee, sort_order? }
// ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { label, fee = 0, sort_order = 0 } = req.body;
  if (!label?.trim()) {
    return res.status(400).json({ error: 'Nama area wajib diisi.' });
  }
  const parsedFee = parseFloat(fee);
  if (isNaN(parsedFee) || parsedFee < 0) {
    return res.status(400).json({ error: 'Ongkir harus berupa angka >= 0.' });
  }
  try {
    const [result] = await db.query(
      `INSERT INTO delivery_areas (label, fee, sort_order) VALUES (?, ?, ?)`,
      [label.trim(), parsedFee, parseInt(sort_order) || 0]
    );
    const [rows] = await db.query('SELECT id, label, fee, is_active, sort_order FROM delivery_areas WHERE id = ?', [result.insertId]);
    const area = rows[0];
    res.status(201).json({ message: 'Area berhasil ditambahkan.', area: { ...area, fee: Number(area.fee) } });
  } catch (err) {
    console.error('[delivery-areas] POST error:', err);
    res.status(500).json({ error: 'Gagal menambahkan area.' });
  }
});

// ─────────────────────────────────────────────────────────
// PUT /api/delivery-areas/:id  — edit label / fee / sort_order
// Body: { label?, fee?, sort_order? }
// ─────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { label, fee, sort_order } = req.body;

  const sets = [];
  const params = [];

  if (label !== undefined) {
    if (!label.trim()) return res.status(400).json({ error: 'Nama area tidak boleh kosong.' });
    sets.push('label = ?');
    params.push(label.trim());
  }
  if (fee !== undefined) {
    const parsedFee = parseFloat(fee);
    if (isNaN(parsedFee) || parsedFee < 0) return res.status(400).json({ error: 'Ongkir tidak valid.' });
    sets.push('fee = ?');
    params.push(parsedFee);
  }
  if (sort_order !== undefined) {
    sets.push('sort_order = ?');
    params.push(parseInt(sort_order) || 0);
  }

  if (sets.length === 0) return res.status(400).json({ error: 'Tidak ada field yang diupdate.' });

  sets.push('updated_at = NOW()');
  params.push(id);

  try {
    const [result] = await db.query(
      `UPDATE delivery_areas SET ${sets.join(', ')} WHERE id = ?`,
      params
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Area tidak ditemukan.' });
    const [rows] = await db.query('SELECT id, label, fee, is_active, sort_order FROM delivery_areas WHERE id = ?', [id]);
    const area = rows[0];
    res.json({ message: 'Area berhasil diupdate.', area: { ...area, fee: Number(area.fee) } });
  } catch (err) {
    console.error('[delivery-areas] PUT error:', err);
    res.status(500).json({ error: 'Gagal mengupdate area.' });
  }
});

// ─────────────────────────────────────────────────────────
// PATCH /api/delivery-areas/:id/toggle  — aktif/nonaktif
// ─────────────────────────────────────────────────────────
router.patch('/:id/toggle', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT is_active FROM delivery_areas WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Area tidak ditemukan.' });
    const newState = rows[0].is_active ? 0 : 1;
    await db.query('UPDATE delivery_areas SET is_active = ?, updated_at = NOW() WHERE id = ?', [newState, id]);
    res.json({ message: `Area ${newState ? 'diaktifkan' : 'dinonaktifkan'}.`, is_active: newState });
  } catch (err) {
    console.error('[delivery-areas] PATCH toggle error:', err);
    res.status(500).json({ error: 'Gagal mengubah status area.' });
  }
});

// ─────────────────────────────────────────────────────────
// DELETE /api/delivery-areas/:id  — hapus area
// ─────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM delivery_areas WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Area tidak ditemukan.' });
    res.json({ message: 'Area berhasil dihapus.' });
  } catch (err) {
    console.error('[delivery-areas] DELETE error:', err);
    res.status(500).json({ error: 'Gagal menghapus area.' });
  }
});

module.exports = router;
