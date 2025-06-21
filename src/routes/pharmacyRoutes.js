const express = require('express');
const pharmacyController = require('../controllers/pharmacyController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Pharmacy location routes
router.get('/nearby', pharmacyController.getNearbyPharmacies);

// Inventory management routes
router.get('/inventory', pharmacyController.getPharmacyInventory);
router.post('/inventory', pharmacyController.addToInventory);
router.put('/inventory/:id', pharmacyController.updateInventoryItem);

// Pharmacy alerts and analytics
router.get('/alerts/low-stock', pharmacyController.getLowStockAlerts);
router.get('/alerts/expiring', pharmacyController.getExpiringMedicines);
router.get('/analytics', pharmacyController.getPharmacyAnalytics);

module.exports = router;