const express = require('express');
const fileController = require('../controllers/fileController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// File upload and management
router.post('/upload', fileController.uploadMiddleware, fileController.uploadFile);
router.get('/', fileController.getFiles);
router.get('/analytics', fileController.getFileAnalytics);
router.get('/:id/download', fileController.downloadFile);
router.get('/:id/thumbnail', fileController.getThumbnail);
router.put('/:id', fileController.updateFile);
router.delete('/:id', fileController.deleteFile);

module.exports = router;