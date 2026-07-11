// routes/transactions.js — API untuk Admin Panel: Daftar Transaksi
// ============================================================
// Endpoint yang disediakan:
//   GET /api/transactions   → list semua transaksi (untuk Transactions.tsx)
// ============================================================
const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { requireAdminAuth } = require('../middleware/auth');

// 🔒 Semua route di file ini wajib login admin yang valid
router.use(requireAdminAuth);
// ─────────────────────────────────────────────────────────
// GET /api/transactions
// List semua transaksi, terbaru duluan, join order_number & customer_name
// ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         t.id,
         o.order_number,
         c.name as customer_name,
         t.transaction_number,
         t.payment_method,
         t.payment_status,
         t.amount,
         t.amount_paid,
         t.paid_at,
         t.expired_at,
         t.created_at
       FROM transactions t
       JOIN orders o     ON o.id = t.order_id
       JOIN customers c  ON c.id = o.customer_id
       ORDER BY t.created_at DESC`
    );

    const transactions = rows.map(t => ({
      id: t.id,
      order_number: t.order_number,
      customer_name: t.customer_name,
      transaction_number: t.transaction_number,
      payment_method: t.payment_method,
      payment_status: t.payment_status,
      amount: Number(t.amount),
      amount_paid: t.amount_paid !== null ? Number(t.amount_paid) : null,
      paid_at: t.paid_at,
      expired_at: t.expired_at,
      created_at: t.created_at,
    }));

    res.json({ transactions });
  } catch (err) {
    console.error('[API/transactions] Error fetching transactions:', err);
    res.status(500).json({ error: 'Gagal mengambil data transaksi dari database.' });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/transactions/:id
// Detail satu transaksi (opsional, untuk keperluan lanjutan)
// ─────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT
         t.id, o.order_number, c.name as customer_name, c.phone as customer_phone,
         t.transaction_number, t.payment_method, t.payment_status,
         t.amount, t.amount_paid, t.payment_proof_url, t.gateway_ref,
         t.paid_at, t.expired_at, t.notes, t.created_at
       FROM transactions t
       JOIN orders o     ON o.id = t.order_id
       JOIN customers c  ON c.id = o.customer_id
       WHERE t.id = ?
       LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    }

    const t = rows[0];
    res.json({
      transaction: {
        id: t.id,
        order_number: t.order_number,
        customer_name: t.customer_name,
        customer_phone: t.customer_phone,
        transaction_number: t.transaction_number,
        payment_method: t.payment_method,
        payment_status: t.payment_status,
        amount: Number(t.amount),
        amount_paid: t.amount_paid !== null ? Number(t.amount_paid) : null,
        payment_proof_url: t.payment_proof_url,
        gateway_ref: t.gateway_ref,
        paid_at: t.paid_at,
        expired_at: t.expired_at,
        notes: t.notes,
        created_at: t.created_at,
      },
    });
  } catch (err) {
    console.error('[API/transactions/:id] Error:', err);
    res.status(500).json({ error: 'Gagal mengambil detail transaksi.' });
  }
});

module.exports = router;