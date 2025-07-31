const express = require('express');
const ocrController = require('../controllers/ocrController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// OCR processing routes
router.post('/process', ocrController.processPrescriptionImage);
router.post('/validate', ocrController.validateOCRResults);
router.post('/enhance', ocrController.enhanceImage);

// OCR history and analytics
router.get('/history', ocrController.getOCRHistory);
router.get('/analytics', ocrController.getOCRAnalytics);

module.exports = router;
