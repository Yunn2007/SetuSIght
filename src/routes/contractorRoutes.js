const express = require('express');
const router = express.Router();
const contractorController = require('../controllers/contractorController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/', requireAuth, contractorController.getAllContractors);
router.get('/:id', requireAuth, contractorController.getContractorById);
router.post('/', requireAuth, requireRole('admin'), contractorController.createContractor);
router.put('/:id', requireAuth, requireRole('admin'), contractorController.updateContractor);

module.exports = router;
