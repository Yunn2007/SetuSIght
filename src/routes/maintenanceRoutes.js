const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Work Orders
router.get('/', requireAuth, maintenanceController.getAllMaintenance);
router.get('/:id', requireAuth, maintenanceController.getMaintenanceById);
router.post('/', requireAuth, requireRole('admin'), maintenanceController.createMaintenance);
router.put('/:id', requireAuth, requireRole('contractor', 'admin'), maintenanceController.updateMaintenance);

// Repair & Completion Evidence (Phase 8)
router.get('/:id/evidence', requireAuth, maintenanceController.getMaintenanceEvidence);
router.post('/:id/evidence', requireAuth, requireRole('contractor', 'admin'), upload.single('image'), maintenanceController.uploadMaintenanceEvidence);
router.delete('/:id/evidence/:evidenceId', requireAuth, requireRole('admin'), maintenanceController.deleteMaintenanceEvidence);

module.exports = router;
