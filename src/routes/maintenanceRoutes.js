const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/', requireAuth, maintenanceController.getAllMaintenance);
router.get('/:id', requireAuth, maintenanceController.getMaintenanceById);
router.post('/', requireAuth, requireRole('admin'), maintenanceController.createMaintenance);
router.put('/:id', requireAuth, requireRole('contractor', 'admin'), maintenanceController.updateMaintenance);

module.exports = router;
