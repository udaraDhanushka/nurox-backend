const express = require('express');
const medicineController = require('../controllers/medicineController');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  validate,
  validateQuery,
  schemas,
} = require('../middleware/validation');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Medicine CRUD operations
router.post(
  '/',
  validate(schemas.createMedicine),
  medicineController.createMedicine
);
router.get('/', medicineController.getMedicines);
router.get('/suggestions', medicineController.getMedicineSuggestions);
router.get('/analytics', medicineController.getMedicineAnalytics);
router.get('/:id', medicineController.getMedicine);
router.put('/:id', medicineController.updateMedicine);
router.delete('/:id', medicineController.deleteMedicine);

// Drug interaction operations
router.post('/interactions/check', medicineController.checkInteractions);
router.post('/interactions', medicineController.addInteraction);

module.exports = router;
