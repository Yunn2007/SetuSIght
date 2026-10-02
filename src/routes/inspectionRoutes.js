const express = require('express');
const router = express.Router();
const inspectionController = require('../controllers/inspectionController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Get inspections list & details
router.get('/', requireAuth, inspectionController.getAllInspections);
router.get('/:id', requireAuth, inspectionController.getInspectionById);

// Create inspection with image upload (Inspector & Admin)
router.post(
  '/',
  requireAuth,
  requireRole('inspector', 'admin'),
  upload.single('image'),
  inspectionController.createInspection
);

// Trigger ML placeholder analysis
router.post('/:id/analyze', requireAuth, inspectionController.analyzeInspection);

module.exports = router;
