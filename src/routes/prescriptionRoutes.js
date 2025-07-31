const express = require('express');
const prescriptionController = require('../controllers/prescriptionController');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  validate,
  validateQuery,
  schemas,
} = require('../middleware/validation');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Prescription CRUD operations
router.post(
  '/',
  validate(schemas.createPrescription),
  prescriptionController.createPrescription
);
router.get(
  '/',
  validateQuery(schemas.prescriptionQuery),
  prescriptionController.getPrescriptions
);
router.get('/analytics', prescriptionController.getPrescriptionAnalytics);
router.get('/:id', prescriptionController.getPrescription);
router.put('/:id/status', prescriptionController.updatePrescriptionStatus);

// Prescription item operations
router.put(
  '/items/:itemId/dispense',
  prescriptionController.dispensePrescriptionItem
);

// OCR processing
router.post('/ocr/process', prescriptionController.processOCRPrescription);

module.exports = router;
