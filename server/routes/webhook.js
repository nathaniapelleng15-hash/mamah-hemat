const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const db = require("../db");
const { sendWhatsappReceipt } = require("../services/whatsapp");
require("dotenv").config();

/**
 * GET /api/webhook/midtrans
 * Endpoint tambahan untuk pengujian / test webhook dari dashboard Midtrans
 */
router.get("/midtrans", (req, res) => {
  res.status(200).send("OK - Midtrans Webhook Receiver is Active");
});

/**
 * POST /api/webhook/midtrans
 */
router.post("/midtrans", async (req, res) => {
  const {
    order_id,
    transaction_id,
    transaction_status,
    fraud_status,
    gross_amount,
    status_code,
    signature_key,
  } = req.body;

  if (!order_id) {
    return res.status(400).json({
      error: "order_id tidak ditemukan.",
    });
  }

  // Jika ini adalah test notification dari dashboard Midtrans, langsung kembalikan 200 OK
  if (order_id.startsWith("payment_notif_test")) {
    console.log(`[WEBHOOK] Test notification received: ${order_id}`);
    return res.status(200).json({
      success: true,
      message: "Test notification received successfully",
    });
  }

  /**
   * ====================================================
   * VALIDASI SIGNATURE MIDTRANS
   * ====================================================
   */

  const hash = crypto
    .createHash("sha512")
    .update(
      order_id +
        status_code +
        gross_amount +
        process.env.MIDTRANS_SERVER_KEY
    )
    .digest("hex");

  if (hash !== signature_key) {
    console.log("Signature tidak valid");
    return res.status(403).json({
      error: "Invalid Signature",
    });
  }

  console.log(
    `[WEBHOOK] ${order_id} -> ${transaction_status}`
  );

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // Join ke customers supaya kita punya nama & nomor WA untuk kirim struk
    const [rows] = await conn.query(
      `
      SELECT
        o.id AS order_id,
        o.grand_total,
        o.delivery_method,
        o.delivery_address,
        o.delivery_area_label,
        t.id AS tx_id,
        t.payment_status,
        c.name AS customer_name,
        c.phone AS customer_phone
      FROM orders o
      JOIN transactions t
        ON t.order_id = o.id
      JOIN customers c
        ON c.id = o.customer_id
      WHERE o.order_number = ?
      LIMIT 1
      `,
      [order_id]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({
        error: "Order tidak ditemukan",
      });
    }

    const {
      order_id: oid,
      tx_id,
      payment_status,
      customer_name,
      customer_phone,
      grand_total,
      delivery_method,
      delivery_address,
      delivery_area_label,
    } = rows[0];

    if (payment_status === "paid") {
      await conn.rollback();

      return res.json({
        success: true,
        message: "Sudah diproses",
      });
    }

    /**
     * ====================================================
     * PAYMENT SUCCESS
     * ====================================================
     */

    const success =
      transaction_status === "settlement" ||
      (transaction_status === "capture" &&
        fraud_status === "accept");

    if (success) {
      await conn.query(
        `
        UPDATE stock_reservations
        SET
          status='confirmed',
          updated_at=NOW()
        WHERE order_id=?
        AND status='pending'
        `,
        [oid]
      );

      await conn.query(
        `
        UPDATE transactions
        SET
          payment_status='paid',
          amount_paid=?,
          gateway_ref=?,
          gateway_response=?,
          paid_at=NOW(),
          updated_at=NOW()
        WHERE id=?
        `,
        [
          gross_amount,
          transaction_id,
          JSON.stringify(req.body),
          tx_id,
        ]
      );

      await conn.query(
        `
        UPDATE orders
        SET
          order_status='confirmed',
          updated_at=NOW()
        WHERE id=?
        `,
        [oid]
      );

      await conn.commit();

      console.log(`${order_id} berhasil dibayar`);

      // 1. Ambil rincian item belanjaan dari database (jalankan sebelum connection dirilis)
      const [orderItems] = await conn.query(
        `SELECT product_name, quantity FROM order_items WHERE order_id = ?`,
        [oid]
      );
      const itemsList = orderItems.map(item => `- ${item.quantity}x ${item.product_name}`).join('\n');

      const formattedAddress = delivery_area_label 
        ? `${delivery_area_label} — ${delivery_address ? delivery_address.trim() : '-'}`
        : (delivery_address ? delivery_address.trim() : '-');
      const deliveryInfo = delivery_method === 'delivery'
        ? `*Alamat Pengiriman:*\n${formattedAddress}`
        : `*Alamat Pickup:*\nTaman adhiloka blok L no 21 Neglasari Kota Tangerang`;

      // ── Kirim struk sukses via WhatsApp (async, tidak memblokir response) ──
      const waSuccessMessage =
        `Halo ${customer_name},\n\n` +
        `Pembayaran untuk pesanan *#${order_id}* sebesar *Rp ${Number(grand_total).toLocaleString('id-ID')}* ` +
        `telah *BERHASIL* kami terima. ✓\n\n` +
        `*Orderan Kakak:*\n${itemsList}\n\n` +
        `${deliveryInfo}\n\n` +
        `Pesanan Anda akan segera kami siapkan. Nanti jika sudah siap akan segera diinfokan ya kak. Terima kasih! 🥰🙏`;
      sendWhatsappReceipt(customer_phone, waSuccessMessage).catch(err =>
        console.error('[webhook/midtrans] Gagal kirim WA struk sukses:', err.message)
      );

      return res.json({
        success: true,
      });
    }

    /**
     * ====================================================
     * PAYMENT FAILED / CANCEL / EXPIRE
     * ====================================================
     */

    const failedStatus = [
      "expire",
      "cancel",
      "deny",
      "failure",
    ];

    if (failedStatus.includes(transaction_status)) {
      await conn.query(
        `
        DELETE FROM stock_reservations
        WHERE order_id=?
        AND status='pending'
        `,
        [oid]
      );

      await conn.query(
        `
        UPDATE transactions
        SET
          payment_status='failed',
          gateway_ref=?,
          gateway_response=?,
          updated_at=NOW()
        WHERE id=?
        `,
        [
          transaction_id,
          JSON.stringify(req.body),
          tx_id,
        ]
      );

      await conn.query(
        `
        UPDATE orders
        SET
          order_status='cancelled',
          updated_at=NOW()
        WHERE id=?
        `,
        [oid]
      );

      await conn.commit();

      console.log(`${order_id} gagal / expired`);

      return res.json({
        success: true,
      });
    }

    /**
     * ====================================================
     * PENDING
     * ====================================================
     */

    await conn.rollback();

    return res.json({
      success: true,
      message: `Status ${transaction_status} tidak memerlukan aksi.`,
    });

  } catch (err) {
    await conn.rollback();

    console.error(err);

    return res.status(500).json({
      error: "Internal Server Error",
    });

  } finally {
    conn.release();
  }
});

module.exports = router;