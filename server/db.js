// db.js — MySQL2 Connection Pool dengan Promise support
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT || '3306'),
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'mamah_hemat_db',
  waitForConnections: true,
  connectionLimit:    10,        // max 10 concurrent queries
  queueLimit:         0,
  timezone:           '+07:00',  // WIB
  charset:            'utf8mb4',
});

// Test koneksi saat startup
pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL terhubung ke database:', process.env.DB_NAME);
    conn.release();
  })
  .catch(err => {
    console.error('❌ Gagal terhubung ke MySQL:', err.message);
    console.error('   Pastikan .env sudah diisi dengan benar dan MySQL berjalan.');
  });

module.exports = pool;
