const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const uploadAvatar = require('../middleware/uploadAvatar');
const Status = require('../models/Status');
const Note = require('../models/Note');
const User = require('../models/User');
const {
  getMe,
  uploadAvatar: uploadAvatarController,
  updateProfile,
  getUserProfile,
  getUserPosts,
  getSavedPosts,
  toggleSavePost,
  updateOnlineStatus,
  getUserStatus,
  deleteAvatar,
  getUserById,
  uploadStory: uploadStoryController,
  getStories,
  markStoryViewed,
  updateOnlineStatusInMemory,
  getOnlineStatus,
  upgradePlan,
} = require('../controllers/userController');

// ---------- Multer config for stories ----------
const storyStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/stories/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const uploadStoryMiddleware = multer({
  storage: storyStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extname = path.extname(file.originalname).length > 0;
    const mimetype = (file.mimetype || '').toLowerCase().startsWith('image/');
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Only supported image files are allowed'));
  },
}).single('image');

// ---------- Notes (public GET) ----------
router.get('/notes', async (req, res) => {
  try {
    const now = new Date();
    await Note.deleteMany({ expiresAt: { $lte: now } });

    const notes = await Note.find({ expiresAt: { $gt: now } })
      .populate('userId', 'username avatar')
      .sort({ createdAt: -1 })
      .lean();

    const formattedNotes = notes
      .filter((note) => note.userId)
      .map((note) => ({
        id: note._id,
        userId: note.userId._id,
        name: note.userId.username,
        avatar: note.userId.avatar,
        text: note.text,
        createdAt: note.createdAt,
        expiresAt: note.expiresAt,
      }));

    res.json({ success: true, notes: formattedNotes });
  } catch (error) {
    console.error('get notes error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ===== AUTHENTICATED ROUTES =====
router.use(auth);

// ===== FAVORITES ENDPOINTS =====

// GET all favorites (places + shops)
router.get('/favorites', async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('favorites')
      .populate('favoriteShops');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({
      success: true,
      favorites: user.favorites || [],
      favoriteShops: user.favoriteShops || [],
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /favorites - Save a place
router.post('/favorites', async (req, res) => {
  try {
    const { placeId } = req.body;
    if (!placeId) {
      return res.status(400).json({ success: false, message: 'placeId required' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    // Avoid duplicates
    if (!user.favorites.includes(placeId)) {
      user.favorites.push(placeId);
      await user.save();
    }
    res.json({ success: true, favorites: user.favorites });
  } catch (error) {
    console.error('Add favorite place error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /favorites - Remove a place
router.delete('/favorites', async (req, res) => {
  try {
    const { placeId } = req.body;
    if (!placeId) {
      return res.status(400).json({ success: false, message: 'placeId required' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.favorites = user.favorites.filter(id => id.toString() !== placeId);
    await user.save();
    res.json({ success: true, favorites: user.favorites });
  } catch (error) {
    console.error('Remove favorite place error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /favorites/shops - Save a shop
router.post('/favorites/shops', async (req, res) => {
  try {
    const { shopId } = req.body;
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'shopId required' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!user.favoriteShops.includes(shopId)) {
      user.favoriteShops.push(shopId);
      await user.save();
    }
    res.json({ success: true, favoriteShops: user.favoriteShops });
  } catch (error) {
    console.error('Add favorite shop error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /favorites/shops - Remove a shop
router.delete('/favorites/shops', async (req, res) => {
  try {
    const { shopId } = req.body;
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'shopId required' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.favoriteShops = user.favoriteShops.filter(id => id.toString() !== shopId);
    await user.save();
    res.json({ success: true, favoriteShops: user.favoriteShops });
  } catch (error) {
    console.error('Remove favorite shop error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ===== END FAVORITES =====

// 🔥 NEW: Get subscriptions
router.get('/subscriptions', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const subscriptions = (user.paymentHistory || []).map(p => ({
      _id: p._id || `sub_${Date.now()}`,
      plan: p.plan,
      planName: p.planName,
      amount: p.amount,
      currency: p.currency || 'RWF',
      paymentMethod: p.paymentMethod || 'MTN MoMo',
      transactionId: p.transactionId,
      status: p.status || 'success',
      createdAt: p.paymentDate || p.createdAt,
      expiresAt: p.expiryDate,
    })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, subscriptions });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 🔥 Upgrade plan
router.post('/upgrade', upgradePlan);

// ---------- Online status endpoints (in-memory) ----------
router.post('/online', updateOnlineStatusInMemory);
router.get('/:userId/online', getOnlineStatus);

// ---------- Profile & avatar ----------
router.get('/me', getMe);
router.get('/profile', getUserProfile);
router.put('/profile', updateProfile);
router.post('/avatar', uploadAvatar, uploadAvatarController);
router.delete('/avatar', deleteAvatar);

// ---------- Stories ----------
router.post('/story', uploadStoryMiddleware, uploadStoryController);
router.get('/stories', getStories);
router.post('/story/view', markStoryViewed);

// ---------- Posts ----------
router.get('/my-posts', getUserPosts);
router.get('/saved', getSavedPosts);
router.post('/save/:postId', toggleSavePost);
router.delete('/save/:postId', toggleSavePost);

// ---------- Legacy status (DB) ----------
router.get('/statuses', async (req, res) => {
  try {
    const statuses = await Status.find()
      .populate('userId', 'username avatar')
      .sort({ updatedAt: -1 })
      .lean();

    const formattedStatuses = statuses
      .filter((item) => item.userId)
      .map((item) => ({
        userId: item.userId._id,
        name: item.userId.username,
        avatar: item.userId.avatar,
        status: item.status,
      }));

    res.json({ success: true, statuses: formattedStatuses });
  } catch (error) {
    console.error('get statuses error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/status', async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const rawStatus = req.body && req.body.status;
    const trimmedStatus = typeof rawStatus === 'string' ? rawStatus.trim() : '';

    if (!trimmedStatus) {
      return res.status(400).json({ success: false, message: 'Status cannot be empty' });
    }
    if (trimmedStatus.length > 100) {
      return res.status(400).json({ success: false, message: 'Status must be 100 characters or less' });
    }

    const updatedStatusDoc = await Status.findOneAndUpdate(
      { userId: req.user.id },
      { status: trimmedStatus, updatedAt: new Date() },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, status: updatedStatusDoc });
  } catch (error) {
    console.error('update status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/status/:userId', getUserStatus);

// ---------- Notes ----------
router.post('/notes', async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admin can create updates.' });
    }

    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) {
      return res.status(400).json({ success: false, message: 'Note cannot be empty' });
    }
    if (text.length > 60) {
      return res.status(400).json({ success: false, message: 'Note must be 60 characters or less' });
    }

    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

    const note = await Note.findOneAndUpdate(
      { userId: req.user.id },
      { text, createdAt, expiresAt },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).populate('userId', 'username avatar');

    res.json({ success: true, note: {
      id: note._id,
      userId: note.userId._id,
      name: note.userId.username,
      avatar: note.userId.avatar,
      text: note.text,
      createdAt: note.createdAt,
      expiresAt: note.expiresAt,
    } });
  } catch (error) {
    console.error('create note error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/notes/:noteId', async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) {
      return res.status(400).json({ success: false, message: 'Note cannot be empty' });
    }
    if (text.length > 60) {
      return res.status(400).json({ success: false, message: 'Note must be 60 characters or less' });
    }

    const note = await Note.findOneAndUpdate(
      { _id: req.params.noteId, userId: req.user.id },
      { text, createdAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      { new: true }
    ).populate('userId', 'username avatar');

    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    res.json({ success: true, note: {
      id: note._id,
      userId: note.userId._id,
      name: note.userId.username,
      avatar: note.userId.avatar,
      text: note.text,
      createdAt: note.createdAt,
      expiresAt: note.expiresAt,
    } });
  } catch (error) {
    console.error('update note error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/notes/:noteId', async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const note = await Note.findOneAndDelete({ _id: req.params.noteId, userId: req.user.id });
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    res.json({ success: true, message: 'Note deleted' });
  } catch (error) {
    console.error('delete note error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ---------- Socket registration ----------
router.post('/register-socket', async (req, res) => {
  try {
    const { socketId } = req.body;
    if (!socketId) return res.status(400).json({ success: false, message: 'socketId required' });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.currentSession = user.currentSession || {};
    user.currentSession.socketId = socketId;
    user.currentSession.lastSeen = new Date();
    await user.save();
    res.json({ success: true });
  } catch (e) {
    console.error('register-socket error', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ----- Admin-only endpoints for blocking/unblocking users -----
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Admin access required' });
};

// Block a user
router.put('/admin/users/:userId/block', isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndUpdate(userId, { blocked: true }, { new: true, select: '-password' });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User blocked successfully', user });
  } catch (err) {
    console.error('Block user error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Unblock a user
router.put('/admin/users/:userId/unblock', isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndUpdate(userId, { blocked: false }, { new: true, select: '-password' });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User unblocked successfully', user });
  } catch (err) {
    console.error('Unblock user error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all users (admin only)
router.get('/admin/users', isAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ---------- Generic user fetch (must be LAST) ----------
router.get('/:userId', getUserById);

module.exports = router;