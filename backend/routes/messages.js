// routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const uploadMessageMedia = require('../middleware/uploadMessageMedia');
const upload = require('../middleware/upload');
const {
  sendMessage,
  getConversations,
  getMessages,
  markAsRead,
  editMessage,
  deleteMessage,
  uploadImage,
} = require('../controllers/messageController');

router.use(auth);

// Send message (text, audio, reply)
router.post('/send', uploadMessageMedia, sendMessage);

// Upload multiple images
router.post('/upload-image', upload.messageImages.array('images', 100), uploadImage);


// Conversations
router.get('/conversations', getConversations);
router.get('/thread/:userId1/:userId2', getMessages);
router.get('/:postId/:userId1/:userId2', getMessages);

// Message actions
router.put('/read/:messageId', markAsRead);
router.put('/edit/:messageId', editMessage);
router.delete('/:messageId', deleteMessage);

module.exports = router;