const express = require('express');
const router = express.Router();
const bridgeController = require('../controllers/bridgeController');
const { requireAuth, requireRole, optionalAuth } = require('../middleware/authMiddleware');

// Public / Role-aware bridges list & details
router.get('/', optionalAuth, bridgeController.getAllBridges);
router.get('/:id', optionalAuth, bridgeController.getBridgeById);
router.get('/:id/timeline', optionalAuth, bridgeController.getBridgeTimeline);

// Protected Admin mutations
router.post('/', requireAuth, requireRole('admin'), bridgeController.createBridge);
router.put('/:id', requireAuth, requireRole('admin'), bridgeController.updateBridge);
router.delete('/:id', requireAuth, requireRole('admin'), bridgeController.deleteBridge);

module.exports = router;
