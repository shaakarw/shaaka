// routes/admin.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');   // ✅ already imported
const User = require('../models/User');
const AppSetting = require('../models/AppSetting');
const adminController = require('../controllers/adminController');
const storageService = require('../services/storage/storageService');
const { parseTutorialSections } = require('../utils/tutorialSettings');
const { normalizeForAuth } = require('../utils/phoneNormalizer');

// ---------- Admin verification middleware ----------
const verifyAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Admin token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Invalid token payload' });
    }

    let user;
    try {
      user = await User.findById(userId);
    } catch (error) {
      console.error('Admin auth user lookup failed:', error);
      return res.status(503).json({ success: false, message: 'Authentication service is temporarily unavailable', reason: 'auth_unavailable' });
    }
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required', reason: 'admin_unavailable' });
    }
    const sessionId = user.currentSession?.sessionId;
    if (
      Number(decoded.tokenVersion ?? 0) !== Number(user.tokenVersion ?? 0)
      || (decoded.sessionId && (!sessionId || decoded.sessionId !== sessionId))
    ) {
      if (sessionId && decoded.sessionId && decoded.sessionId !== sessionId) {
        return res.status(401).json({ success: false, message: 'signed_in_elsewhere', reason: 'session_invalidated' });
      }
      return res.status(401).json({ success: false, message: 'session_ended', reason: 'session_ended' });
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

    const adminPassword = await AppSetting.findOne({ key: `adminpassword:${user._id}` }).lean();
    const match = await bcrypt.compare(password, adminPassword?.value || user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const previousSession = user.currentSession?.sessionId ? { ...user.currentSession } : null;
    const deviceId = crypto.randomBytes(16).toString('hex');
    const sessionId = crypto.randomBytes(24).toString('hex');
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.currentSession = {
      sessionId,
      deviceId,
      socketId: '',
      createdAt: new Date(),
      lastSeen: new Date(),
    };
    await user.save();

    const token = jwt.sign(
      { userId: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion, sessionId, deviceId },
      process.env.JWT_SECRET
    );
    try {
      const io = require('../socket').getIO();
      if (io && previousSession?.socketId) {
        io.to(previousSession.socketId).emit('force-logout', {
          message: 'Your account has been signed in on another device.',
        });
      }
    } catch (error) {
      console.error('Could not notify the previous admin session:', error);
    }

    return res.json({ success: true, token, session: { sessionId, deviceId } });
  } catch (e) {
    console.error('admin login error:', e);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ---------- All routes below require admin ----------
router.use(verifyAdmin);

router.get('/session', (req, res) => {
  res.json({ success: true, session: req.adminUser.currentSession || {} });
});

router.post('/logout', async (req, res) => {
  try {
    const user = await User.findById(req.adminUser._id);
    if (!user) return res.status(404).json({ success: false, message: 'Admin not found' });
    const previousSocketId = user.currentSession?.socketId;
    user.currentSession = {};
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.isOnline = false;
    user.lastSeen = new Date();
    await user.save();
    try {
      const io = require('../socket').getIO();
      if (io && previousSocketId) io.to(previousSocketId).emit('force-logout', { message: 'You have logged out of this account.' });
    } catch (socketError) {
      console.error('Could not disconnect the logged-out admin session:', socketError);
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Admin logout error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/change-password/verify', async (req, res) => {
  try {
    const { currentPassword } = req.body || {};
    if (!currentPassword) {
      return res.status(400).json({ success: false, message: 'Current password is required' });
    }

    const adminPassword = await AppSetting.findOne({ key: `adminpassword:${req.adminUser._id}` }).lean();
    const passwordHash = adminPassword?.value || req.adminUser.password;
    if (!(await bcrypt.compare(currentPassword, passwordHash))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Could not verify admin password:', error);
    return res.status(500).json({ success: false, message: 'Could not verify the current password.' });
  }
});

router.put('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new passwords are required' });
    }
    if (newPassword.length < 4 || /\s/.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 4 characters without spaces' });
    }

    const settingKey = `adminpassword:${req.adminUser._id}`;
    const adminPassword = await AppSetting.findOne({ key: settingKey }).lean();
    const passwordHash = adminPassword?.value || req.adminUser.password;
    if (!(await bcrypt.compare(currentPassword, passwordHash))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    if (await bcrypt.compare(newPassword, passwordHash)) {
      return res.status(400).json({ success: false, message: 'Password already used' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await AppSetting.findOneAndUpdate(
      { key: settingKey },
      {
        $set: { value: newPasswordHash, updatedBy: req.adminUser._id },
        $setOnInsert: { description: 'Separate password for admin login' },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.json({ success: true, message: 'Admin password updated' });
  } catch (error) {
    console.error('Could not change admin password:', error);
    return res.status(500).json({ success: false, message: 'Could not change the admin password.' });
  }
});

router.get('/tutorial-image', async (req, res) => {
  try {
    const setting = await AppSetting.findOne({ key: 'tutorialimage' }).lean();
    const sections = parseTutorialSections(setting?.value).map(section => ({
      id: section.id,
      title: section.title,
      images: section.images.map(image => ({
        url: storageService.getPublicMediaUrl(image.storageKey),
        storageKey: image.storageKey,
      })),
    }));
    return res.json({
      success: true,
      sections,
    });
  } catch (error) {
    console.error('Could not load admin tutorial image:', error);
    return res.status(500).json({ success: false, message: 'Could not load tutorial image.' });
  }
});

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
router.delete('/mall-shops/:shopId', adminController.deleteMallShop);
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