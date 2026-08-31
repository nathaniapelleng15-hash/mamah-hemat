// routes/settings.js — API Pengaturan Sistem (WhatsApp CS Admin, dll)
const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { requireAdminAuth } = require('../middleware/auth');

/**
 * Normalisasi nomor WhatsApp ke format 62xxx
 */
function normalizePhone(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

// ─────────────────────────────────────────────────────────
// GET /api/settings  (PUBLIK — untuk frontend mengambil no WA CS)
// ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT setting_key, setting_value FROM settings');
    const settings = {};
    rows.forEach(r => {
      settings[r.setting_key] = r.setting_value;
    });
    // Default fallback jika belum terisi di DB
    if (!settings.admin_whatsapp) {
      settings.admin_whatsapp = '6281290840140';
    }
    res.json({ settings });
  } catch (err) {
    console.error('[settings] GET error:', err);
    res.status(500).json({ error: 'Gagal memuat pengaturan.' });
  }
});

// 🔒 Route di bawah wajib login admin
router.use(requireAdminAuth);

// ─────────────────────────────────────────────────────────
// PUT /api/settings  — update pengaturan (admin)
// Body: { admin_whatsapp: "081290840140" }
// ─────────────────────────────────────────────────────────
router.put('/', async (req, res) => {
  const { admin_whatsapp } = req.body;
  if (!admin_whatsapp) {
    return res.status(400).json({ error: 'Nomor WhatsApp admin wajib diisi.' });
  }

  const cleanedPhone = normalizePhone(admin_whatsapp);
  if (cleanedPhone.length < 10) {
    return res.status(400).json({ error: 'Nomor WhatsApp tidak valid.' });
  }

  try {
    await db.query(
      `INSERT INTO settings (setting_key, setting_value)
       VALUES ('admin_whatsapp', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [cleanedPhone]
    );

    res.json({
      message: 'Pengaturan WhatsApp admin berhasil diperbarui.',
      settings: { admin_whatsapp: cleanedPhone }
    });
  } catch (err) {
    console.error('[settings] PUT error:', err);
    res.status(500).json({ error: 'Gagal memperbarui pengaturan.' });
  }
});

module.exports = router;
