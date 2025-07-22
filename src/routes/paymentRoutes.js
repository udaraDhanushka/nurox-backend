const express = require('express');
const paymentController = require('../controllers/paymentController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// PayHere webhook (no auth required)
router.post('/payhere-webhook', express.urlencoded({ extended: true }), paymentController.handlePayHereWebhook);

// Apply auth middleware to all other routes
router.use(authMiddleware);

// Payment operations
router.post('/payhere/create', paymentController.createPayHerePayment);
router.post('/confirm', paymentController.confirmPayment);
router.get('/', paymentController.getPayments);
router.get('/analytics', paymentController.getPaymentAnalytics);
router.get('/:id', paymentController.getPayment);
router.post('/:id/refund', paymentController.requestRefund);

module.exports = router;