// middleware/auth.js — Validasi Token Admin
// ============================================================
// Requirement yang diimplementasi:
//   ✅ Melindungi endpoint admin (orders, transactions, products CRUD)
//      dari akses tanpa login.
//   Catatan: Ini validasi TOKEN SESSION (bukan re-verifikasi PIN).
//   Token dibuat saat login PIN sukses (lihat AdminLogin.tsx) dan
//   disimpan di localStorage sebagai 'mh_admin_token' + 'mh_admin_expiry'.
//   Middleware ini memastikan request ke backend membawa token yang sah
//   dan sesi belum kadaluarsa — dicek ulang di sisi SERVER, bukan cuma
//   percaya klaim dari client.
// ============================================================
const db = require('../db');

async function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token admin tidak ditemukan. Silakan login kembali.' });
  }

  try {
    // Cek token di tabel admin_sessions (lihat catatan migrasi di bawah)
    const [rows] = await db.query(
      `SELECT s.id, s.admin_id, s.expires_at, a.name, a.role, a.is_active
       FROM admin_sessions s
       JOIN admin_users a ON a.id = s.admin_id
       WHERE s.token = ?
       LIMIT 1`,
      [token]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Sesi tidak valid. Silakan login kembali.' });
    }

    const session = rows[0];

    if (!session.is_active) {
      return res.status(403).json({ error: 'Akun admin tidak aktif.' });
    }

    if (new Date(session.expires_at) < new Date()) {
      // Sesi expired — bersihkan dari database
      await db.query('DELETE FROM admin_sessions WHERE id = ?', [session.id]);
      return res.status(401).json({ error: 'Sesi telah berakhir. Silakan login kembali.' });
    }

    // Lolos — lampirkan info admin ke request untuk dipakai handler berikutnya
    req.admin = {
      id: session.admin_id,
      name: session.name,
      role: session.role,
    };

    next();
  } catch (err) {
    console.error('[middleware/auth] Error validating token:', err);
    return res.status(500).json({ error: 'Gagal memvalidasi sesi admin.' });
  }
}

module.exports = { requireAdminAuth };