// middleware/upload.js — Multer middleware untuk upload gambar produk
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// Folder tujuan: root project / public / uploads
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');

// Buat folder jika belum ada
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    // Format nama: timestamp-namafile_asli.ext (hapus spasi/karakter aneh)
    const timestamp = Date.now();
    const safeName  = file.originalname
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, '-')
      .replace(/-+/g, '-');
    cb(null, `${timestamp}-${safeName}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format file tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Max 5 MB
  },
});

module.exports = upload;
