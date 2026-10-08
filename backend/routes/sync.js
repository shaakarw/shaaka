const express = require('express');
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const Post = require('../models/Post');

const router = express.Router();
router.use(auth);

router.get('/pull', async (req, res) => {
  try {
    const since = new Date(Number(req.query.since) || 0);
    const userId = req.user.id;
    const [messages, posts] = await Promise.all([
      Message.find({ $or: [{ senderId: userId }, { receiverId: userId }], updatedAt: { $gt: since } }).sort({ updatedAt: 1 }).limit(500),
      Post.find({ updatedAt: { $gt: since } }).sort({ updatedAt: 1 }).limit(100),
    ]);
    res.json({ success: true, serverTimestamp: Date.now(), messages, posts, deleted: [] });
  } catch (error) {
    console.error('SYNC PULL ERROR:', error);
    res.status(500).json({ success: false, message: 'Sync failed' });
  }
});

module.exports = router;