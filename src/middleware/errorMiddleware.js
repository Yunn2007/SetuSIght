/**
 * SetuSight — Centralized Error Handling Middleware
 */

function errorHandler(err, req, res, next) {
  console.error(`[API Error] ${req.method} ${req.url}:`, err.message);

  // Database Service Unavailable
  if (err.code === 'DATABASE_UNAVAILABLE' || err.message.includes('Database service unavailable') || err.message.includes('fetch failed')) {
    return res.status(503).json({
      success: false,
      error: 'Database service unavailable'
    });
  }

  // Cloudinary / Image Storage Service Unavailable
  if (err.code === 'CLOUDINARY_UNAVAILABLE' || err.message.includes('Image upload service unavailable')) {
    return res.status(503).json({
      success: false,
      error: 'Image upload service unavailable'
    });
  }

  // Multer Errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File size exceeds maximum limit of 10MB'
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal server error'
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
