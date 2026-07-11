// routes/orders.js — API untuk Admin Panel: Pesanan Masuk
// ============================================================
// Endpoint yang disediakan:
//   GET   /api/orders                  → list semua pesanan (untuk halaman Orders.tsx)
//   GET   /api/orders/:id               → detail satu pesanan
//   PATCH /api/orders/:id/status        → update status pesanan
//   PATCH /api/orders/:id/notes         → simpan catatan admin
// ============================================================
const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { requireAdminAuth } = require('../middleware/auth');

const VALID_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];

// 🔒 Semua route di file ini wajib login admin yang valid
router.use(requireAdminAuth);

// ─────────────────────────────────────────────────────────
// Helper: Ambil semua order lengkap dengan items & addons
// (dipakai bareng oleh GET / dan GET /:id)
// ─────────────────────────────────────────────────────────
async function fetchOrdersWithDetails(whereClause = '', params = []) {
  // 1. Ambil data order + customer (join)
  const [orders] = await db.query(
    `SELECT
       o.id, o.order_number, o.delivery_method,
       o.delivery_area_id, o.delivery_area_label, o.delivery_area,
       o.delivery_address, o.delivery_map_link, o.delivery_fee,
       o.delivery_date, o.delivery_time, o.notes, o.subtotal, o.addons_total,
       o.grand_total, o.order_status, o.admin_notes, o.created_at, o.updated_at,
       c.id as customer_id, c.name as customer_name, c.phone as customer_phone
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     ${whereClause}
     ORDER BY o.created_at DESC`,
    params
  );

  if (!orders.length) return [];

  const orderIds = orders.map(o => o.id);
  const placeholders = orderIds.map(() => '?').join(',');

  // 2. Ambil semua items untuk order-order ini sekaligus (hindari N+1 query)
  const [items] = await db.query(
    `SELECT id, order_id, product_id, product_name, unit_price, quantity, subtotal
     FROM order_items
     WHERE order_id IN (${placeholders})`,
    orderIds
  );

  // 3. Ambil semua addons untuk order-order ini sekaligus
  const [addons] = await db.query(
    `SELECT id, order_id, addon_id, addon_name, price
     FROM order_addons
     WHERE order_id IN (${placeholders})`,
    orderIds
  );

  // 4. Susun ulang jadi bentuk nested sesuai interface Order di frontend (data.ts)
  return orders.map(o => ({
    id: o.id,
    order_number: o.order_number,
    delivery_method: o.delivery_method,
    delivery_area_id: o.delivery_area_id,
    delivery_area_label: o.delivery_area_label || null,
    delivery_area: o.delivery_area || null,
    delivery_date: o.delivery_date,
    delivery_time: o.delivery_time,
    delivery_address: o.delivery_address,
    delivery_map_link: o.delivery_map_link || null,
    delivery_fee: Number(o.delivery_fee),
    notes: o.notes,
    subtotal: Number(o.subtotal),
    addons_total: Number(o.addons_total),
    grand_total: Number(o.grand_total),
    order_status: o.order_status,
    admin_notes: o.admin_notes || '',
    created_at: o.created_at,
    updated_at: o.updated_at,
    customer: {
      id: o.customer_id,
      name: o.customer_name,
      phone: o.customer_phone,
    },
    items: items
      .filter(i => i.order_id === o.id)
      .map(i => ({
        id: i.id,
        product_id: i.product_id,
        product_name: i.product_name,
        unit_price: Number(i.unit_price),
        quantity: i.quantity,
        subtotal: Number(i.subtotal),
      })),
    addons: addons
      .filter(a => a.order_id === o.id)
      .map(a => ({
        id: a.id,
        addon_id: a.addon_id,
        addon_name: a.addon_name,
        price: Number(a.price),
      })),
  }));
}


// ─────────────────────────────────────────────────────────
// GET /api/orders
// List semua pesanan, terbaru duluan (dipakai Orders.tsx)
// ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const orders = await fetchOrdersWithDetails();
    res.json({ orders });
  } catch (err) {
    console.error('[API/orders] Error fetching orders:', err);
    res.status(500).json({ error: 'Gagal mengambil data pesanan dari database.' });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/orders/:id
// Detail satu pesanan (opsional, buat halaman detail terpisah nanti)
// ─────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const orders = await fetchOrdersWithDetails('WHERE o.id = ?', [id]);
    if (!orders.length) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    }
    res.json({ order: orders[0] });
  } catch (err) {
    console.error('[API/orders/:id] Error:', err);
    res.status(500).json({ error: 'Gagal mengambil detail pesanan.' });
  }
});

// ─────────────────────────────────────────────────────────
// PATCH /api/orders/:id/status
// Update status pesanan (dipanggil dari tombol "Update Status" admin)
// Body: { status: 'confirmed' | 'preparing' | ... }
// ─────────────────────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Status tidak valid. Gunakan salah satu: ${VALID_STATUSES.join(', ')}`,
    });
  }

  try {
    const [result] = await db.query(
      'UPDATE orders SET order_status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    }

    res.json({ message: 'Status pesanan berhasil diupdate.', orderId: id, status });
  } catch (err) {
    console.error('[API/orders/:id/status] Error:', err);
    res.status(500).json({ error: 'Gagal mengupdate status pesanan.' });
  }
});

// ─────────────────────────────────────────────────────────
// PATCH /api/orders/:id/notes
// Simpan catatan internal admin
// Body: { adminNotes: string }
// ─────────────────────────────────────────────────────────
router.patch('/:id/notes', async (req, res) => {
  const { id } = req.params;
  const { adminNotes } = req.body;

  if (typeof adminNotes !== 'string') {
    return res.status(400).json({ error: 'adminNotes wajib berupa teks.' });
  }

  try {
    const [result] = await db.query(
      'UPDATE orders SET admin_notes = ?, updated_at = NOW() WHERE id = ?',
      [adminNotes, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    }

    res.json({ message: 'Catatan admin berhasil disimpan.', orderId: id });
  } catch (err) {
    console.error('[API/orders/:id/notes] Error:', err);
    res.status(500).json({ error: 'Gagal menyimpan catatan admin.' });
  }
});

module.exports = router;