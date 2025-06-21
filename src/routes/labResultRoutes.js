const express = require('express');
const labResultController = require('../controllers/labResultController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { validate, validateQuery, schemas } = require('../middleware/validation');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Lab result CRUD operations
router.post('/', validate(schemas.createLabResult), labResultController.createLabResult);
router.get('/', labResultController.getLabResults);
router.get('/analytics', labResultController.getLabResultAnalytics);
router.get('/available-tests', labResultController.getAvailableTests);
router.get('/:id', labResultController.getLabResult);
router.put('/:id', validate(schemas.updateLabResult), labResultController.updateLabResult);
router.delete('/:id', labResultController.deleteLabResult);

module.exports = router;