const express = require('express');
const router = express.Router();
const inspectionController = require('../controllers/inspectionController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

/**
 * Middleware to support single or multiple image uploads seamlessly.
 * Normalizes all uploaded patch images into req.inspectionFiles.
 */
const handleInspectionUpload = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) return next(err);
    req.inspectionFiles = [];
    if (Array.isArray(req.files) && req.files.length > 0) {
      req.inspectionFiles = req.files.filter(f => f.mimetype && f.mimetype.startsWith('image/'));
    } else if (req.file) {
      req.inspectionFiles = [req.file];
    }
    next();
  });
};

// Get inspections list & details
router.get('/', requireAuth, inspectionController.getAllInspections);
router.get('/:id', requireAuth, inspectionController.getInspectionById);

// Create inspection session with multi-image upload (Inspector & Admin)
router.post(
  '/',
  requireAuth,
  requireRole('inspector', 'admin'),
  handleInspectionUpload,
  inspectionController.createInspection
);

// Trigger real YOLOv8 ML re-analysis
router.post('/:id/analyze', requireAuth, inspectionController.analyzeInspection);

module.exports = router;
