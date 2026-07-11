// routes/checkout.js — Stock Reservation + QRIS Generation (Midtrans)
// ============================================================
// Requirement yang diimplementasi:
//   ✅ #1 Reserve stok saat checkout (bukan saat payment confirmed)
//   ✅ #2 Validasi stok real-time sebelum generate QR
//   ✅ #5 Handle race condition dengan SELECT FOR UPDATE (atomic transaction)
//
// Payment gateway: MIDTRANS (Core API - payment_type: qris)
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../db');
require('dotenv').config();

const TTL_MINUTES = parseInt(process.env.RESERVATION_TTL_MINUTES || '15');
const MOCK_MODE = process.env.MIDTRANS_MOCK_MODE === 'true';

// Base URL Midtrans Core API — sandbox vs production
const MIDTRANS_BASE_URL = process.env.MIDTRANS_IS_PRODUCTION === 'true'
  ? 'https://api.midtrans.com'
  : 'https://api.sandbox.midtrans.com';

// ─────────────────────────────────────────────────────────
// POST /api/checkout/reserve
// Dipanggil saat customer klik "Lanjut Bayar"
// Body: { customer, items, addons, deliveryMethod, deliveryAreaId, ... }
// ─────────────────────────────────────────────────────────
router.post('/reserve', async (req, res) => {
  const {
    customer,
    items,
    addons = [],
    deliveryMethod = 'pickup',
    deliveryAreaId = null,
    deliveryArea = '',
    deliveryAreaLabel = '',
    deliveryAddress = '',
    deliveryMapLink = '',
    deliveryFee: clientDeliveryFee,
    notes = ''
  } = req.body;

  if (!customer?.name || !customer?.phone) {
    return res.status(400).json({ error: 'Nama dan nomor WhatsApp wajib diisi.' });
  }
  if (!items?.length) {
    return res.status(400).json({ error: 'Keranjang belanja kosong.' });
  }
  if (deliveryMethod === 'delivery' && !deliveryAddress.trim()) {
    return res.status(400).json({ error: 'Alamat pengantaran wajib diisi jika Anda memilih metode Delivery.' });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // ── STEP 1: Lock baris stok semua produk yang dipesan ─────────────────
    // SELECT FOR UPDATE: MySQL memblokir row ini sampai transaction selesai.
    // Kalau ada 2 request paralel, request ke-2 akan MENUNGGU sampai request
    // ke-1 COMMIT atau ROLLBACK — mencegah race condition overselling.
    const productIds = items.map(i => i.productId);
    const placeholders = productIds.map(() => '?').join(',');

    const [stocks] = await conn.query(
      `SELECT id, name, price, stock_qty, stock_status
       FROM products
       WHERE id IN (${placeholders})
       FOR UPDATE`,  // 🔒 ROW LOCK — kunci inti anti-overselling
      productIds
    );

    // Buat map productId → stok info
    const stockMap = {};
    for (const row of stocks) {
      stockMap[row.id] = row;
    }

    // ── STEP 2: Hitung stok yang sedang di-reserve orang lain ─────────────
    // reserved_qty = jumlah stok yang dikunci oleh checkout yang belum expire
    const [reservedRows] = await conn.query(
      `SELECT product_id, SUM(quantity) as reserved_qty
       FROM stock_reservations
       WHERE product_id IN (${placeholders})
         AND status = 'pending'
         AND expires_at > NOW()
       GROUP BY product_id`,
      productIds
    );

    const reservedMap = {};
    for (const row of reservedRows) {
      reservedMap[row.product_id] = parseInt(row.reserved_qty);
    }

    // ── STEP 3: Validasi stok tersedia cukup untuk semua item ─────────────
    const stockErrors = [];
    for (const item of items) {
      const stockInfo = stockMap[item.productId];
      const reserved = reservedMap[item.productId] || 0;
      const available = (stockInfo?.stock_qty || 0) - reserved;

      if (!stockInfo || stockInfo.stock_status !== 'available') {
        stockErrors.push(`"${item.name}" tidak tersedia saat ini.`);
      } else if (available < item.quantity) {
        stockErrors.push(
          `"${item.name}" stok tidak cukup. Tersisa: ${available} porsi, Anda minta: ${item.quantity} porsi.`
        );
      }
    }

    if (stockErrors.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        error: 'Beberapa item sudah habis atau stok tidak mencukupi.',
        details: stockErrors,
      });
    }

    // ── STEP 4: Buat order dan customer record ────────────────────────────
    // Upsert customer (tambah jika belum ada, update jika phone sudah ada)
    const [custResult] = await conn.query(
      `INSERT INTO customers (name, phone)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), updated_at = NOW()`,
      [customer.name.trim(), customer.phone.trim()]
    );
    const customerId = custResult.insertId || (
      await conn.query('SELECT id FROM customers WHERE phone = ?', [customer.phone.trim()])
    )[0][0]?.id;

    // Generate order number unik untuk Midtrans
    const crypto = require("crypto");

    const orderNumber = `MH-${crypto.randomUUID()}`;

    for (const item of items) {
      subtotal += (stockMap[item.productId]?.price || item.unitPrice) * item.quantity;
    }
    for (const addon of addons) {
      addonsTotal += addon.price;
    }

    // Gunakan deliveryFee dari klien (sudah dihitung berdasarkan area dari DB)
    // Jika delivery & ada area ID, cross-check ke tabel delivery_areas untuk keamanan
    let deliveryFee = 0;
    if (deliveryMethod === 'delivery') {
      if (deliveryAreaId) {
        try {
          const [areaRows] = await conn.query(
            'SELECT fee FROM delivery_areas WHERE id = ? AND is_active = 1',
            [deliveryAreaId]
          );
          deliveryFee = areaRows.length ? Number(areaRows[0].fee) : (Number(clientDeliveryFee) || 0);
        } catch {
          deliveryFee = Number(clientDeliveryFee) || 0;
        }
      } else {
        deliveryFee = Number(clientDeliveryFee) || 0;
      }
    }
    const grandTotal = subtotal + addonsTotal + deliveryFee;

    // Insert order
    const [orderResult] = await conn.query(
      `INSERT INTO orders
         (order_number, customer_id, delivery_method,
          delivery_area_id, delivery_area_label, delivery_area,
          delivery_address, delivery_map_link, delivery_fee,
          notes, subtotal, addons_total, grand_total, order_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        orderNumber, customerId, deliveryMethod,
        deliveryMethod === 'delivery' ? (deliveryAreaId || null) : null,
        deliveryMethod === 'delivery' ? (deliveryAreaLabel || deliveryArea || null) : null,
        deliveryMethod === 'delivery' ? (deliveryArea || null) : null,
        deliveryMethod === 'delivery' ? deliveryAddress.trim() : null,
        deliveryMethod === 'delivery' ? (deliveryMapLink.trim() || null) : null,
        deliveryFee,
        notes, subtotal, addonsTotal, grandTotal
      ]
    );
    const orderId = orderResult.insertId;

    // Insert order_items
    for (const item of items) {
      const stock = stockMap[item.productId];
      const itemSubtotal = (stock?.price || item.unitPrice) * item.quantity;
      await conn.query(
        `INSERT INTO order_items
           (order_id, product_id, product_name, unit_price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.productId, stock?.name || item.name,
          stock?.price || item.unitPrice, item.quantity, itemSubtotal]
      );
    }

    // Insert order_addons
    for (const addon of addons) {
      await conn.query(
        `INSERT INTO order_addons (order_id, addon_id, addon_name, price)
         VALUES (?, ?, ?, ?)`,
        [orderId, addon.id, addon.name, addon.price]
      );
    }

    // ── STEP 5: Insert reservasi stok untuk setiap item ───────────────────
    const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);
    const reservationIds = [];

    for (const item of items) {
      const [resResult] = await conn.query(
        `INSERT INTO stock_reservations
           (order_id, product_id, quantity, status, expires_at)
         VALUES (?, ?, ?, 'pending', ?)`,
        [orderId, item.productId, item.quantity, expiresAt]
      );
      reservationIds.push(resResult.insertId);
    }

    // ── STEP 6: Buat transaksi + generate QRIS (mock atau Midtrans) ───────
    const txNumber = `TXN-${orderNumber}`;
    let qrisPayload, midtransTransactionId;

    if (MOCK_MODE) {
      // MODE MOCK: Generate QR string palsu untuk testing lokal tanpa Midtrans
      qrisPayload = generateMockQris(orderNumber, grandTotal);
      midtransTransactionId = `MOCK-${orderNumber}`;
    } else {
      // MODE MIDTRANS: Panggil Core API sungguhan (charge QRIS)
      const midtransResult = await callMidtransQrisCharge({
        orderId: orderNumber,
        grossAmount: grandTotal,
        customer,
        expiryMinutes: TTL_MINUTES,
      });
      qrisPayload = midtransResult.qr_string;
      midtransTransactionId = midtransResult.transaction_id;
    }

    // Insert ke tabel transactions
    await conn.query(
      `INSERT INTO transactions
         (order_id, transaction_number, payment_method, payment_status,
          amount, expired_at, gateway_ref)
       VALUES (?, ?, 'qris', 'pending', ?, ?, ?)`,
      [orderId, txNumber, grandTotal, expiresAt, midtransTransactionId]
    );

    // ── COMMIT — semua berhasil ────────────────────────────────────────────
    await conn.commit();

    return res.status(201).json({
      success: true,
      orderId,
      orderNumber,
      transactionNumber: txNumber,
      grandTotal,
      qrisPayload,           // string QR code untuk ditampilkan di frontend
      midtransTransactionId,
      expiresAt: expiresAt.toISOString(),
      ttlMinutes: TTL_MINUTES,
      mockMode: MOCK_MODE,
    });

  } catch (err) {
    await conn.rollback();
    console.error('[checkout/reserve] Error:', err);
    return res.status(500).json({
      error: 'Terjadi kesalahan internal. Silakan coba lagi.',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/checkout/status/:orderNumber
// Poll status pembayaran dari frontend (setiap 5 detik)
// ─────────────────────────────────────────────────────────
router.get('/status/:orderNumber', async (req, res) => {
  const { orderNumber } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT o.order_status, t.payment_status, t.paid_at, t.expired_at,
              o.grand_total, o.id as order_id, o.delivery_method, o.delivery_address, o.delivery_fee
       FROM orders o
       JOIN transactions t ON t.order_id = o.id
       WHERE o.order_number = ?
       LIMIT 1`,
      [orderNumber]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Order tidak ditemukan.' });
    }

    const row = rows[0];
    return res.json({
      orderNumber,
      orderId: row.order_id,
      orderStatus: row.order_status,
      paymentStatus: row.payment_status,
      paidAt: row.paid_at,
      expiredAt: row.expired_at,
      grandTotal: row.grand_total,
      deliveryMethod: row.delivery_method,
      deliveryAddress: row.delivery_address,
      deliveryFee: row.delivery_fee,
    });
  } catch (err) {
    console.error('[checkout/status] Error:', err);
    return res.status(500).json({ error: 'Gagal mengambil status order.' });
  }
});

// ─────────────────────────────────────────────────────────
// Helper: Generate Mock QRIS string (untuk testing tanpa Midtrans)
// Format: string panjang yang meniru format QRIS Indonesia (EMVCO)
// ─────────────────────────────────────────────────────────
function generateMockQris(orderNumber, amount) {
  const timestamp = Date.now();
  const mockMerchantId = 'ID1023000000000000000';
  // Format minimal QRIS (mock, tidak bisa di-scan ke payment gateway sungguhan)
  return [
    '000201',                           // Payload Format Indicator
    '010212',                           // Point of Initiation Method (dynamic)
    `26${String(37 + mockMerchantId.length).padStart(2, '0')}`,
    `0014COM.MAMAHHEMAT`,              // Acquirer / Merchant info (mock)
    `01${String(mockMerchantId.length).padStart(2, '0')}${mockMerchantId}`,
    '52040000',                         // Merchant Category Code
    '5303360',                          // Transaction Currency (IDR = 360)
    `54${String(amount.toString().length).padStart(2, '0')}${amount}`, // Amount
    '5802ID',                           // Country Code
    '5913Mamah Hemat',                 // Merchant Name
    '6013Jakarta Selatan',             // Merchant City
    `62${String(20 + orderNumber.length).padStart(2, '0')}`,
    `05${String(orderNumber.length).padStart(2, '0')}${orderNumber}`, // Order ref
    `6304${timestamp.toString(16).toUpperCase().slice(-4)}`, // CRC (mock)
  ].join('');
}

// ─────────────────────────────────────────────────────────
// Helper: Panggil Midtrans Core API — charge QRIS
// Docs: https://docs.midtrans.com/reference/qris-1
// Aktif saat MIDTRANS_MOCK_MODE=false. Butuh MIDTRANS_SERVER_KEY di .env
// ─────────────────────────────────────────────────────────
async function callMidtransQrisCharge({ orderId, grossAmount, customer, expiryMinutes }) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    throw new Error('MIDTRANS_SERVER_KEY belum diset. Set MIDTRANS_MOCK_MODE=true untuk testing lokal, atau isi MIDTRANS_SERVER_KEY di .env.');
  }

  const authHeader = `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`;

  const response = await fetch(`${MIDTRANS_BASE_URL}/v2/charge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': authHeader,
    },
    body: JSON.stringify({
      payment_type: 'qris',
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount,
      },
      customer_details: {
        first_name: customer?.name || 'Customer',
        phone: customer?.phone || '',
      },
      qris: {
        acquirer: 'gopay', // bisa diganti 'airpay shopee' sesuai kebutuhan
      },
      custom_expiry: {
        expiry_duration: expiryMinutes,
        unit: 'minute',
      },
    }),
  });

  const data = await response.json();

  if (!response.ok || (data.status_code && !['200', '201'].includes(String(data.status_code)))) {
    console.error('[Midtrans] Charge error:', data);
    throw new Error(data.status_message || 'Gagal membuat transaksi QRIS di Midtrans.');
  }

  // Response Midtrans untuk QRIS bisa berupa `qr_string` langsung,
  // atau `actions` array berisi URL gambar QR (generate-qr-code).
  const qrString = data.qr_string
    || data.actions?.find(a => a.name === 'generate-qr-code')?.url
    || '';

  return {
    qr_string: qrString,
    transaction_id: data.transaction_id,
    raw: data,
  };
}

module.exports = router;