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
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
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
