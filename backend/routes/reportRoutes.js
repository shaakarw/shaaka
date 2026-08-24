// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const Post = require('../models/Post');
const auth = require('../middleware/auth');

// Submit a report (authenticated)
router.post('/', auth, async (req, res) => {
  try {
    const { postId, reason } = req.body;
    if (!postId || !reason) {
      return res.status(400).json({ success: false, message: 'Post ID and reason are required' });
    }

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Check if already reported by this user
    const existing = await Report.findOne({ reporter: req.user.id, post: postId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'You have already reported this post' });
    }

    const report = new Report({
      reporter: req.user.id,
      post: postId,
      reason,
    });
    await report.save();

    // Optionally mark post as reported (for admin visibility)
    await Post.findByIdAndUpdate(postId, { isReported: true });

    res.status(201).json({ success: true, message: 'Report submitted successfully', report });
  } catch (err) {
    console.error('Submit report error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;