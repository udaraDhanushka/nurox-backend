const express = require('express');
const patientController = require('../controllers/patientController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Patient profile access for doctors/pharmacists
router.get('/:patientId', patientController.getPatientById);
router.get('/:patientId/profile', patientController.getPatientProfile);
router.get('/:patientId/last-updated', patientController.getPatientLastUpdated);

module.exports = router;
