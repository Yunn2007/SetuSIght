/**
 * SetuSight — Multer Upload Middleware (In-Memory Stream)
 * 
 * Strict Architecture:
 * Multer buffers image files directly in memory strictly for immediate streaming
 * to Cloudinary. No images are written to or persisted in the local filesystem.
 */
const multer = require('multer');

// Store file strictly in memory buffer for Cloudinary streaming
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const mime = (file.mimetype || '').toLowerCase();
  const originalName = (file.originalname || '').toLowerCase();
  const isImageMime = mime.startsWith('image/') || mime === 'application/octet-stream';
  const hasImageExt = /\.(jpe?g|png|webp|jfif|avif|bmp|tiff)$/i.test(originalName);

  if (isImageMime || hasImageExt) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file format. Only JPEG, PNG, and WebP images are allowed.');
    error.statusCode = 400;
    cb(error, false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB maximum limit
  }
});

module.exports = upload;
