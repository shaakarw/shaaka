// routes/admin.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');   // ✅ already imported
const User = require('../models/User');
const adminController = require('../controllers/adminController');
const { normalizeForAuth } = require('../utils/phoneNormalizer');

// ---------- Admin verification middleware ----------
const verifyAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Admin token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Invalid token payload' });
    }

    const user = await User.findById(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    req.adminUser = user;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// ---------- Admin login ----------
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body || {};
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Phone and password required' });
    }

    const normalizedPhone = normalizeForAuth(phone);
    if (!normalizedPhone) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = await User.findOne({ phone: normalizedPhone });
    if (!user || user.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({ success: true, token });
  } catch (e) {
    console.error('admin login error:', e);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ---------- All routes below require admin ----------
router.use(verifyAdmin);

// Dashboard stats
router.get('/stats', adminController.getDashboardStats);

// Users
router.get('/users', adminController.getUsers);
router.delete('/users/:userId', adminController.deleteUser);
router.put('/users/:userId/block', adminController.blockUser);
router.put('/users/:userId/unblock', adminController.unblockUser);
router.get('/users/:userId/details', adminController.getUserDetails); 

// Posts
router.get('/posts', adminController.getPosts);
router.patch('/posts/:postId', adminController.updatePost);
router.delete('/posts/:postId', adminController.deletePost);
router.put('/posts/:postId/stop', adminController.stopPost);
router.put('/posts/:postId/restore', adminController.restorePost);

// Shops
router.get('/shops', adminController.getShops);
router.delete('/shops/:shopId', adminController.deleteShop);
router.put('/shops/:shopId/stop', adminController.stopShop);
router.put('/shops/:shopId/restore', adminController.restoreShop);

// Business ideas
router.get('/business-ideas', adminController.getManagedBusinessIdeas);
router.get('/business-ideas/:ideaId', adminController.getManagedBusinessIdea);
router.post('/business-ideas', adminController.createManagedBusinessIdea);
router.put('/business-ideas/:ideaId', adminController.updateManagedBusinessIdea);
router.patch('/business-ideas/:ideaId/status', adminController.updateManagedBusinessIdeaStatus);
router.delete('/business-ideas/:ideaId', adminController.deleteManagedBusinessIdea);

// Reports
router.get('/reports', adminController.getReports);
router.get('/payments', adminController.getPayments);
router.put('/reports/:reportId/ignore', adminController.ignoreReport);

// Admin: update per-user upload limits and permissions
router.put('/users/:userId/limits', adminController.updateUserLimits);

// Admin: trigger message retention cleanup
router.post('/cleanup/old-messages', adminController.cleanupOldMessages);

module.exports = router;