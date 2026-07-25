// index.js — Express Server Entry Point
// Mamah Hemat Catering — Stock Reservation Backend API

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const checkoutRoutes = require('./routes/checkout');
const webhookRoutes = require('./routes/webhook');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const transactionRoutes = require('./routes/transactions');
const authRoutes = require('./routes/auth');
const deliveryAreaRoutes = require('./routes/delivery-areas');
const { scheduleCleanup } = require('./jobs/cleanup');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy header (sangat krusial untuk mendeteksi IP asli user di server hosting/Nginx)
app.set('trust proxy', 1);

// ─────────────────────────────────────────────────────────────
// Security Middleware
// ─────────────────────────────────────────────────────────────

// Helmet mengamankan Express app dengan menyetel berbagai HTTP headers (XSS protection, Clickjacking protection, dll)
app.use(helmet());

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    process.env.APP_URL,
  ].filter(Boolean),
  credentials: true,
}));

// Rate Limiting Global: batasi DDoS dan spamming API
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 menit
  max: 300, // maks 300 request per menit per IP
  message: { error: 'Terlalu banyak permintaan dari perangkat Anda. Silakan coba lagi nanti.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Lewati rate limit untuk endpoint webhook Midtrans agar notifikasi pembayaran tidak pernah terblokir
  skip: (req) => req.originalUrl.startsWith('/api/webhook'),
});

app.use('/api', apiLimiter);

// Rate Limiting Spesifik Checkout: proteksi stock reservation dari bot/spam booking palsu
const checkoutLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 menit
  max: 8, // maks 8 kali klik checkout per 2 menit per IP
  message: { error: 'Terlalu banyak klik checkout. Silakan tunggu 2 menit sebelum mencoba lagi.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/checkout/reserve', checkoutLimiter);

// Midtrans webhook menggunakan JSON biasa
app.use(express.json({ limit: '10kb' })); // Batasi ukuran payload json maks 10kb untuk mencegah payload injection
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─────────────────────────────────────────────────────────────
// Static Files
// ─────────────────────────────────────────────────────────────

app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', 'public', 'uploads'))
);

// ─────────────────────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────────────────────

app.use('/api/checkout', checkoutRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/delivery-areas', deliveryAreaRoutes);

// ─────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'Mamah Hemat Catering API',
    paymentGateway: 'Midtrans',
    time: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    error: `Endpoint tidak ditemukan: ${req.method} ${req.path}`,
  });
});

// ─────────────────────────────────────────────────────────────
// Error Handler
// ─────────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err);

  res.status(500).json({
    error: 'Internal server error.',
  });
});

// ─────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 Mamah Hemat API berjalan di http://localhost:${PORT}`);
  console.log(`Mode              : ${process.env.NODE_ENV || 'development'}`);
  console.log(`Payment Gateway   : Midtrans`);
  console.log(`Webhook Endpoint  : /api/webhook/midtrans\n`);

  // Jalankan cron job auto release reservasi
  scheduleCleanup();
});

module.exports = app;