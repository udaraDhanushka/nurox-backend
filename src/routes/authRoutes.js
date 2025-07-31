const express = require('express');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();

// Public routes
router.post('/register', validate(schemas.register), authController.register);
router.post('/login', validate(schemas.login), authController.login);
router.post(
  '/forgot-password',
  validate(schemas.forgotPassword),
  authController.forgotPassword
);
router.post(
  '/reset-password',
  validate(schemas.resetPassword),
  authController.resetPassword
);
router.post('/refresh-token', authController.refreshToken);

// Protected routes
router.use(authMiddleware);
router.get('/me', authController.me);
router.post('/logout', authController.logout);
router.post('/logout-all', authController.logoutAll);
router.post('/change-password', authController.changePassword);

module.exports = router;
