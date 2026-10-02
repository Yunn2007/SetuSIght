const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/', requireAuth, notificationController.getNotifications);
router.put('/read-all', requireAuth, notificationController.markAllRead);
router.put('/:id/read', requireAuth, notificationController.markRead);

module.exports = router;
