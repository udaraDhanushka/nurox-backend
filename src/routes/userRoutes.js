const express = require('express');
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();

// Apply auth middleware to all user routes
router.use(authMiddleware);

// Profile routes
router.get('/profile', userController.getProfile);
router.put('/profile', validate(schemas.updateProfile), userController.updateProfile);
router.get('/role-data', userController.getRoleSpecificData);
router.put('/language', userController.updateLanguage);

// Role-specific profile routes
router.put('/patient-profile', userController.updatePatientProfile);
router.put('/doctor-profile', userController.updateDoctorProfile);
router.put('/pharmacist-profile', userController.updatePharmacistProfile);

// Account management
router.delete('/account', userController.deleteAccount);

module.exports = router;