/**
 * SetuSight — Cloudinary Image Storage Configuration
 * Single Source of Truth for Inspection Photos: Cloudinary
 */
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

function isConfigured() {
  return Boolean(
    cloudName &&
    apiKey &&
    apiSecret &&
    !cloudName.includes('your-cloud') &&
    !apiKey.includes('your-cloudinary')
  );
}

if (isConfigured()) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });
}

/**
 * Uploads an in-memory buffer directly to Cloudinary using upload_stream.
 * Throws a clean 503 error if Cloudinary is not configured or rejects the upload.
 * 
 * @param {Buffer} buffer - In-memory image file buffer from Multer
 * @param {Object} options - Upload options (folder, tags, etc.)
 * @returns {Promise<{ secure_url: string, public_id: string, format: string, width: number, height: number }>}
 */
function uploadImageBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    if (!isConfigured()) {
      const err = new Error('Image upload service unavailable. Please ensure valid CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are configured in .env.');
      err.statusCode = 503;
      err.code = 'CLOUDINARY_UNAVAILABLE';
      return reject(err);
    }

    const defaultOptions = {
      folder: 'setusight/inspections',
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ quality: 'auto', fetch_format: 'auto' }]
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      { ...defaultOptions, ...options },
      (error, result) => {
        if (error) {
          const uploadErr = new Error(`Cloudinary upload failed: ${error.message}`);
          uploadErr.statusCode = 502;
          return reject(uploadErr);
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          format: result.format,
          width: result.width,
          height: result.height
        });
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Health check helper for Cloudinary
 */
async function checkCloudinaryHealth() {
  if (!isConfigured()) {
    return { ok: false, message: 'Cloudinary credentials not configured' };
  }
  try {
    const result = await cloudinary.api.ping();
    return { ok: true, message: 'Cloudinary connected successfully', result };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

module.exports = {
  cloudinary,
  uploadImageBuffer,
  checkCloudinaryHealth,
  isConfigured
};
