// server/simulate-payment.js
// Script untuk mensimulasikan pembayaran sukses (settlement) di lokal/development.
// Bermanfaat ketika simulator Midtrans Sandbox sedang error / "unparsable".
//
// Cara menjalankan:
// node simulate-payment.js MH-XXXXXX-XXXXXX

const crypto = require('crypto');
require('dotenv').config();

const orderId = process.argv[2];
const grossAmountInput = process.argv[3]; // Opsional, jika kosong akan dicari dari database

if (!orderId) {
  console.error('\n❌ Masukkan Order ID. Contoh: node simulate-payment.js MH-202608-05315536\n');
  process.exit(1);
}

const db = require('./db');

async function run() {
  try {
    // 1. Dapatkan info order dari database jika grossAmount tidak dimasukkan
    let grossAmount = grossAmountInput;
    if (!grossAmount) {
      const [rows] = await db.query('SELECT grand_total FROM orders WHERE order_number = ?', [orderId]);
      if (!rows.length) {
        console.error(`\n❌ Order ${orderId} tidak ditemukan di database.\n`);
        process.exit(1);
      }
      // Format gross amount agar sesuai format string desimal Midtrans (e.g. 70000.00)
      grossAmount = Number(rows[0].grand_total).toFixed(2);
    } else {
      grossAmount = Number(grossAmount).toFixed(2);
    }

    const statusCode = '200';
    const serverKey = process.env.MIDTRANS_SERVER_KEY;

    if (!serverKey) {
      console.error('\n❌ MIDTRANS_SERVER_KEY tidak ditemukan di .env\n');
      process.exit(1);
    }

    // 2. Hitung signature key yang valid agar lolos verifikasi webhook
    const signatureSource = orderId + statusCode + grossAmount + serverKey;
    const signatureKey = crypto
      .createHash('sha512')
      .update(signatureSource)
      .digest('hex');

    // 3. Siapkan payload webhook tiruan
    const webhookPayload = {
      order_id: orderId,
      transaction_id: 'SIMULATOR-' + crypto.randomBytes(8).toString('hex'),
      transaction_status: 'settlement',
      fraud_status: 'accept',
      gross_amount: grossAmount,
      status_code: statusCode,
      signature_key: signatureKey,
    };

    console.log(`\n⏳ Mengirim simulasi webhook sukses untuk order: ${orderId}...`);
    console.log(`💰 Jumlah: Rp ${Number(grossAmount).toLocaleString('id-ID')}`);

    // 4. Kirim request ke endpoint webhook lokal
    const response = await fetch('http://localhost:3002/api/webhook/midtrans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    const result = await response.json();

    if (response.ok) {
      console.log('\n✅ BERHASIL! Webhook diterima dan diproses.');
      console.log('Status Respons:', result);
    } else {
      console.error('\n❌ Gagal mengirim webhook:', result);
    }

  } catch (error) {
    console.error('\n❌ Terjadi kesalahan saat simulasi:', error.message);
  } finally {
    process.exit(0);
  }
}

run();
