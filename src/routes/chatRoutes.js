const express = require('express');
const chatController = require('../controllers/chatController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Chat operations
router.post('/send', validate(schemas.sendMessage), chatController.sendMessage);
router.get('/conversations', chatController.getConversations);
router.get('/participants', chatController.getChatParticipants);
router.get('/:userId/messages', chatController.getMessages);
router.put('/messages/:messageId/read', chatController.markAsRead);
router.delete('/messages/:messageId', chatController.deleteMessage);

module.exports = router;
