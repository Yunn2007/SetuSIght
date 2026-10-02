const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/overview', requireAuth, analyticsController.getOverview);

module.exports = router;
