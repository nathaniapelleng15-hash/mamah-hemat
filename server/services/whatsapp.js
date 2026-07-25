// server/services/whatsapp.js — Helper terpusat untuk kirim pesan WhatsApp
// ============================================================
// PENTING: File ini HANYA boleh dipanggil dari backend (routes/*.js),
// TIDAK PERNAH dari frontend — karena WHATSAPP_API_TOKEN bersifat rahasia.
// ============================================================
require('dotenv').config();

// Node.js >= 18 sudah punya global fetch, jadi tidak perlu require('node-fetch').
// Kalau project kamu masih pakai Node < 18, uncomment baris berikut:
// const fetch = require('node-fetch');

const WA_PROVIDER_URL = process.env.WHATSAPP_API_URL || 'https://api.fonnte.com/send';
const WA_TOKEN         = process.env.WHATSAPP_API_TOKEN;

/**
 * Normalisasi nomor telepon ke format yang umum diterima gateway WA
 * (62xxxxxxxxxx, tanpa +, spasi, atau strip).
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

/**
 * Kirim pesan WhatsApp lewat provider (default: Fonnte).
 * @param {string} phoneNumber - nomor tujuan, boleh format 08xxx atau 62xxx
 * @param {string} message - isi pesan
 * @returns {Promise<object>} respons dari provider
 */
async function sendWhatsappReceipt(phoneNumber, message) {
  if (!WA_TOKEN) {
    console.warn('[WA] WHATSAPP_API_TOKEN belum diset di .env — pesan tidak dikirim.');
    return { skipped: true, reason: 'missing_token' };
  }

  const target = normalizePhone(phoneNumber);
  if (!target) {
    console.warn('[WA] Nomor tujuan kosong/tidak valid — pesan tidak dikirim.');
    return { skipped: true, reason: 'invalid_phone' };
  }

  try {
    const response = await fetch(WA_PROVIDER_URL, {
      method: 'POST',
      headers: {
        'Authorization': WA_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target,
        message,
        // parameter lain (delay, countryCode, dll) sesuai dokumentasi provider kamu
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[WA] Gagal kirim — provider merespons error:', result);
    } else {
      console.log(`[WA] Terkirim ke ${target}:`, result?.status ?? result);
    }

    return result;
  } catch (error) {
    // Sengaja tidak di-throw ulang ke caller supaya kegagalan kirim WA
    // TIDAK menggagalkan proses checkout/webhook utama.
    console.error('[WA] Error saat mengirim WhatsApp:', error.message);
    return { error: true, message: error.message };
  }
}

module.exports = { sendWhatsappReceipt, normalizePhone };