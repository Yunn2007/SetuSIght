const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/', requireAuth, reportController.getAllReports);
router.get('/:id', requireAuth, reportController.getReportById);
router.post('/generate', requireAuth, requireRole('admin', 'inspector'), reportController.generateReport);

module.exports = router;
