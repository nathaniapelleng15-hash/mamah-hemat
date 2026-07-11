const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const db = require("../db");
require("dotenv").config();

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

    const [rows] = await conn.query(
      `
      SELECT
        o.id AS order_id,
        t.id AS tx_id,
        t.payment_status
      FROM orders o
      JOIN transactions t
        ON t.order_id = o.id
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

    const { order_id: oid, tx_id, payment_status } = rows[0];

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