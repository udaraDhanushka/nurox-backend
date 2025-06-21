const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// General analytics
router.get('/dashboard', analyticsController.getDashboardAnalytics);
router.get('/activity', analyticsController.getUserActivity);

// Role-specific analytics
router.get('/health', analyticsController.getHealthMetrics); // Patients
router.get('/doctor', analyticsController.getDoctorPerformance); // Doctors
router.get('/pharmacy', analyticsController.getPharmacyAnalytics); // Pharmacists
router.get('/system', analyticsController.getSystemAnalytics); // Admins

module.exports = router;