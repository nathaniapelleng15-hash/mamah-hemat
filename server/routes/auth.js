// routes/auth.js — Login Admin (Validasi PIN di Server)
// ============================================================
// Endpoint:
//   POST /api/auth/login   → validasi PIN, terbitkan token session
//   POST /api/auth/logout  → hapus token session
// ============================================================

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');

const SESSION_HOURS = 8;

// ============================================================
// Rate Limiting Login
// Maksimal 5 kali gagal login dalam 15 menit
// ============================================================

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const attemptsByIp = new Map();

function checkRateLimit(ip) {
  const record = attemptsByIp.get(ip);

  if (!record) {
    return { blocked: false };
  }

  // Jika masa blokir sudah lewat, reset
  if (Date.now() - record.firstAttempt > LOCKOUT_MS) {
    attemptsByIp.delete(ip);
    return { blocked: false };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    const remaining = Math.ceil(
      (LOCKOUT_MS - (Date.now() - record.firstAttempt)) / 60000
    );

    return {
      blocked: true,
      remaining,
    };
  }

  return { blocked: false };
}

function recordFailedAttempt(ip) {
  const record = attemptsByIp.get(ip);

  if (!record) {
    attemptsByIp.set(ip, {
      attempts: 1,
      firstAttempt: Date.now(),
    });
    return;
  }

  // Reset jika sudah lewat masa lock
  if (Date.now() - record.firstAttempt > LOCKOUT_MS) {
    attemptsByIp.set(ip, {
      attempts: 1,
      firstAttempt: Date.now(),
    });
    return;
  }

  record.attempts++;
}

function clearAttempts(ip) {
  attemptsByIp.delete(ip);
}

// ============================================================
// Hash PIN
// ============================================================

// PIN admin di-hash pakai SHA-256 + salt sederhana.
// (Untuk keamanan lebih baik, idealnya pakai bcrypt)
function hashPin(pin) {
  return crypto
    .createHash('sha256')
    .update(pin + '_mhcatering_salt')
    .digest('hex');
}

// ============================================================
// Generate Session Token
// ============================================================

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ============================================================
// Safe Hash Compare (Anti Timing Attack)
// ============================================================

function safeCompareHash(a, b) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

// ============================================================
// POST /api/auth/login
// Body:
// {
//   "pin":"123456"
// }
// ============================================================

router.post('/login', async (req, res) => {

  // Ambil IP user
  const ip = req.ip;

  // Cek rate limit
  const rateCheck = checkRateLimit(ip);

  if (rateCheck.blocked) {
    return res.status(429).json({
      error: `Terlalu banyak percobaan gagal. Silakan coba lagi dalam ${rateCheck.remaining} menit.`
    });
  }

  const { pin } = req.body;

  if (!pin || typeof pin !== 'string') {
    return res.status(400).json({
      error: 'PIN wajib diisi.'
    });
  }

  try {

    // Ambil admin aktif pertama
    const [admins] = await db.query(`
      SELECT
        id,
        name,
        email,
        role,
        pin_hash,
        is_active
      FROM admin_users
      WHERE is_active = 1
      LIMIT 1
    `);

    if (!admins.length) {

      // Catat gagal login
      recordFailedAttempt(ip);

      return res.status(404).json({
        error: 'Akun admin tidak ditemukan.'
      });
    }

    const admin = admins[0];

    const inputHash = hashPin(pin);

    // Compare hash secara aman
    if (!safeCompareHash(inputHash, admin.pin_hash)) {

      // Catat gagal login
      recordFailedAttempt(ip);

      return res.status(401).json({
        error: 'PIN salah.'
      });
    }

    // Login berhasil
    clearAttempts(ip);

    // Generate token session
    const token = generateToken();

    const expiresAt = new Date(
      Date.now() + SESSION_HOURS * 60 * 60 * 1000
    );

    await db.query(
      `INSERT INTO admin_sessions
      (admin_id, token, expires_at)
      VALUES (?, ?, ?)`,
      [
        admin.id,
        token,
        expiresAt
      ]
    );

    // Update last login
    await db.query(
      `UPDATE admin_users
      SET last_login_at = NOW()
      WHERE id = ?`,
      [admin.id]
    );

    return res.json({
      token,
      expiresAt: expiresAt.toISOString(),
      admin: {
        id: admin.id,
        name: admin.name,
        role: admin.role
      }
    });

  } catch (err) {

    console.error('[auth/login] Error:', err);

    return res.status(500).json({
      error: 'Gagal memproses login.'
    });
  }

});

// ============================================================
// POST /api/auth/logout
// Header:
// Authorization: Bearer <token>
// ============================================================

router.post('/logout', async (req, res) => {

  const authHeader = req.headers.authorization || '';

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(400).json({
      error: 'Token tidak ditemukan.'
    });
  }

  try {

    await db.query(
      'DELETE FROM admin_sessions WHERE token = ?',
      [token]
    );

    return res.json({
      message: 'Logout berhasil.'
    });

  } catch (err) {

    console.error('[auth/logout] Error:', err);

    return res.status(500).json({
      error: 'Gagal logout.'
    });

  }

});

module.exports = router;