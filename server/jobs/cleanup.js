// jobs/cleanup.js — Auto-Release Expired Reservations (Cron Job)
// ============================================================
// Requirement yang diimplementasi:
//   ✅ #3 Auto-release reservation kalau timeout
//          → Cron berjalan setiap 1 menit
//          → Cari semua reservation pending yang expires_at < NOW()
//          → DELETE reservasi → stok otomatis kembali ke pool
//          → UPDATE order_status = 'cancelled'
// ============================================================
const cron = require('node-cron');
const db   = require('../db');

// Jalankan cleanup setiap 1 menit
const scheduleCleanup = () => {
  cron.schedule('* * * * *', async () => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // ── Temukan semua reservasi yang sudah kadaluarsa ──────────────────
      const [expired] = await conn.query(
        `SELECT sr.id as reservation_id, sr.order_id, sr.product_id, sr.quantity,
                p.name as product_name
         FROM stock_reservations sr
         JOIN products p ON p.id = sr.product_id
         WHERE sr.status = 'pending'
           AND sr.expires_at < NOW()`
      );

      if (expired.length === 0) {
        await conn.rollback();
        return;
      }

      // Kumpulkan order ID unik yang perlu di-cancel
      const orderIds = [...new Set(expired.map(r => r.order_id))];
      console.log(`🕐 [cleanup] Auto-releasing ${expired.length} reservasi untuk ${orderIds.length} order...`);

      // ── Delete reservasi yang kadaluarsa ───────────────────────────────
      // Stok otomatis tersedia kembali karena kalkulasi stok selalu:
      //   available = stock_qty - SUM(pending reservations yang belum expire)
      const reservationIds = expired.map(r => r.reservation_id);
      await conn.query(
        `DELETE FROM stock_reservations
         WHERE id IN (${reservationIds.map(() => '?').join(',')})`,
        reservationIds
      );

      // ── Update order dan transaksi yang terkait ────────────────────────
      for (const orderId of orderIds) {
        await conn.query(
          `UPDATE orders SET order_status = 'cancelled', updated_at = NOW()
           WHERE id = ? AND order_status = 'pending'`,
          [orderId]
        );

        await conn.query(
          `UPDATE transactions SET payment_status = 'failed', updated_at = NOW()
           WHERE order_id = ? AND payment_status = 'pending'`,
          [orderId]
        );
      }

      await conn.commit();

      // Log hasil
      for (const r of expired) {
        console.log(`  🔓 Reservation #${r.reservation_id}: ${r.product_name} x${r.quantity} (Order #${r.order_id}) — stok kembali`);
      }
      console.log(`✅ [cleanup] Selesai. ${expired.length} reservasi dilepas.`);

    } catch (err) {
      await conn.rollback();
      console.error('[cleanup] Error saat auto-release:', err.message);
    } finally {
      conn.release();
    }
  });

  console.log('⏰ [cleanup] Cron job auto-release aktif (setiap 1 menit).');
};

module.exports = { scheduleCleanup };
