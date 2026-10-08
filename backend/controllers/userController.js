// controllers/userController.js
const User = require('../models/User');
const SavedPost = require('../models/SavedPost');
const socketHelper = require('../socket');
const Post = require('../models/Post');
const Place = require('../models/Place');
const Message = require('../models/Message'); // 🔥 ADDED
const fs = require('fs');
const storageService = require('../services/storage/storageService');
const { setOnline, isOnline } = require('../utils/onlineStore');
const { computeAggregatedLimits, getActiveSubscriptions } = require('../utils/subscriptionHelpers_clean');
const { notifyUser } = require('../services/notificationService');

// Helper to clean expired stories (older than 2 days)
const cleanExpiredStories = async (userId = null) => {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const filter = { 'stories.createdAt': { $lt: twoDaysAgo } };
  if (userId) filter._id = userId;
  const users = await User.find(filter);
  for (const user of users) {
    const originalLength = user.stories.length;
    const expiredKeys = user.stories
      .filter(story => story.createdAt < twoDaysAgo)
      .map(story => story.storageKey)
      .filter(storageService.isStorageKey);
    user.stories = user.stories.filter(s => s.createdAt >= twoDaysAgo);
    if (user.stories.length < originalLength) {
      await user.save();
      await Promise.all(expiredKeys.map(key => storageService.deleteMedia(key).catch(error => {
        console.error('[Storage] Expired story cleanup failed:', error.code || 'B2_OPERATION_FAILED');
      })));
    }
  }
};

// @route   GET /api/user/me
// @desc    Get current user profile with aggregated subscription limits and usage
exports.getMe = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'No user context - please login again' });
    }
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Compute aggregated limits and active subscriptions
    const totalLimits = computeAggregatedLimits(user);
    const activeSubscriptions = getActiveSubscriptions(user);
    const videoLimit = typeof user.videoUploadLimitPerDay === 'number' ? Math.max(0, user.videoUploadLimitPerDay) : 0;

    // Today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // ----- Today's posts -----
    const postsToday = await Post.countDocuments({
      user: user._id,
      createdAt: { $gte: today, $lt: tomorrow }
    });
    const remainingPosts = Math.max((totalLimits.postsPerDay || 1) - postsToday, 0);

    const videosToday = await Post.countDocuments({
      user: user._id,
      videoUrl: { $exists: true, $ne: '' },
      createdAt: { $gte: today, $lt: tomorrow }
    });
    const remainingVideos = Math.max(videoLimit - videosToday, 0);

    // ----- Today's places -----
    const placesToday = await Place.countDocuments({
      userId: user._id,
      createdAt: { $gte: today, $lt: tomorrow }
    });
    const remainingPlaces = Math.max((totalLimits.placesPerDay || 1) - placesToday, 0);

// ----- 🔥 Today's message images (images sent in chat) -----
    const messageImagesToday = await Message.countDocuments({
      senderId: user._id,
      imageUrl: { $exists: true, $ne: '' },
      createdAt: { $gte: today, $lt: tomorrow }
    });
    const remainingImages = Math.max(totalLimits.imagesPerMessage - messageImagesToday, 0);

    // Use the user's dailyMessagesUsed counter if available, else fallback to DB count
    const dailyMessagesUsed = user.dailyMessagesUsed !== undefined ? user.dailyMessagesUsed : messageImagesToday;

    // Payment summary
    const paymentHistory = user.paymentHistory || [];
    let totalPaid = 0, paymentCount = 0, lastPayment = null, firstPayment = null;
    if (paymentHistory.length > 0) {
      const sorted = [...paymentHistory].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
      lastPayment = sorted[0];
      firstPayment = sorted[sorted.length - 1];
      paymentHistory.forEach(p => {
        if (p.status === 'success') {
          totalPaid += p.amount;
          paymentCount++;
        }
      });
    }

    // Build user object with extra fields
    const userObj = user.toObject();
    userObj.totalLimits = totalLimits;
    userObj.activeSubscriptions = activeSubscriptions;
    userObj.postsToday = postsToday;
    userObj.remainingPosts = remainingPosts;
    userObj.placesToday = placesToday;
    userObj.remainingPlaces = remainingPlaces;
    userObj.messageImagesToday = messageImagesToday; // 🔥 added
    userObj.remainingImages = remainingImages;       // 🔥 added
    userObj.allowVideoUpload = user.allowVideoUpload === true;
    userObj.videoUploadLimitPerDay = videoLimit;
    userObj.videosToday = videosToday;
    userObj.remainingVideos = remainingVideos;
    userObj.totalPaid = totalPaid;
    userObj.paymentCount = paymentCount;
    userObj.firstPaymentDate = firstPayment ? firstPayment.paymentDate : null;
    userObj.lastPaymentDate = lastPayment ? lastPayment.paymentDate : null;
    userObj.lastPayment = lastPayment; // full object
    // Daily message usage fields
    userObj.dailyMessagesUsed = user.dailyMessagesUsed || 0;
    userObj.messagesLastReset = user.messagesLastReset || new Date();
    userObj.planStartDate = user.planStartDate || user.createdAt;

    res.json({ success: true, user: userObj });
  } catch (error) {
    console.error('getMe error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   POST /api/user/avatar
exports.uploadAvatar = async (req, res) => {
  let uploadedStorageKey = '';
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'No user context' });
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const currentUser = await User.findById(req.user.id).select('avatarStorageKey');
    if (!currentUser) return res.status(404).json({ success: false, message: 'User not found' });
    const previousStorageKey = currentUser.avatarStorageKey;

    const result = await storageService.uploadMedia({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      folder: `users/${req.user.id}/profile`,
      maxBytes: 10 * 1024 * 1024,
    });
    uploadedStorageKey = result.storageKey;
    const avatarUrl = storageService.getMediaUrl(result.storageKey, {
      origin: storageService.getRequestOrigin(req),
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: avatarUrl, avatarStorageKey: result.storageKey, storageProvider: 'b2' },
      { new: true }
    ).select('-password');
    uploadedStorageKey = '';

    if (previousStorageKey && previousStorageKey !== result.storageKey) {
      await storageService.deleteMedia(previousStorageKey).catch(error => {
        console.error('[Storage] Replaced avatar cleanup failed:', error.code || 'B2_OPERATION_FAILED');
      });
    }

    res.json({ success: true, avatarUrl, user });
  } catch (error) {
    if (uploadedStorageKey) await storageService.deleteMedia(uploadedStorageKey).catch(() => {});
    console.error('uploadAvatar error:', error.code || error.message || 'Unknown error');
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Upload failed' });
  }
};

// @route   POST /api/user/story
exports.uploadStory = async (req, res) => {
  let uploadedStorageKey = '';
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const buffer = req.file.buffer || fs.readFileSync(req.file.path);
    const result = await storageService.uploadMedia({
      buffer,
      mimeType: req.file.mimetype,
      folder: `users/${req.user.id}/stories`,
      maxBytes: 10 * 1024 * 1024,
    });
    uploadedStorageKey = result.storageKey;

    const imageUrl = storageService.getMediaUrl(result.storageKey, {
      origin: storageService.getRequestOrigin(req),
    });

    const existingStoryKeys = (user.stories || []).map(story => story.storageKey).filter(storageService.isStorageKey);
    user.stories = user.stories || [];
    user.stories.unshift({ image: imageUrl, storageKey: result.storageKey, createdAt: new Date(), views: [] });

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    user.stories = user.stories.filter(s => s.createdAt >= twoDaysAgo);
    user.stories = user.stories.slice(0, 10);
    await user.save();
    uploadedStorageKey = '';
    const retainedStoryKeys = new Set(user.stories.map(story => story.storageKey));
    const removedStoryKeys = existingStoryKeys.filter(key => !retainedStoryKeys.has(key));
    await Promise.all(removedStoryKeys.map(key => storageService.deleteMedia(key).catch(error => {
      console.error('[Storage] Removed story cleanup failed:', error.code || 'B2_OPERATION_FAILED');
    })));

    try {
      if (req.file && req.file.path) {
        const fs = require('fs');
        fs.unlink(req.file.path, () => {});
      }
    } catch (e) {}

    res.json({ success: true, story: user.stories[0] });
  } catch (error) {
    if (uploadedStorageKey) await storageService.deleteMedia(uploadedStorageKey).catch(() => {});
    console.error('uploadStory error:', error.code || error.message || 'Unknown error');
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Story upload failed' });
  }
};

// @route   GET /api/user/stories
exports.getStories = async (req, res) => {
  try {
    await cleanExpiredStories();

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const users = await User.find({ 'stories.0': { $exists: true } }).select('username avatar stories');
    const viewerId = req.user && req.user.id ? String(req.user.id) : null;

    const result = users
      .map(u => {
        const validStories = (u.stories || [])
          .filter(s => new Date(s.createdAt) >= twoDaysAgo)
          .map(s => ({
            image: s.image,
            createdAt: s.createdAt,
            views: s.views || [],
          }));
        return {
          userId: u._id,
          name: u.username || u.name,
          avatar: u.avatar,
          stories: validStories,
        };
      })
      .filter(u => u.stories.length > 0);

    if (viewerId) {
      result.forEach(u => {
        u.stories = u.stories.map(s => ({
          image: s.image,
          createdAt: s.createdAt,
          hasViewed: (s.views || []).some(v => String(v.userId) === viewerId),
        }));
      });
    }

    result.sort((a, b) => {
      const aUnviewed = a.stories.some(s => !s.hasViewed);
      const bUnviewed = b.stories.some(s => !s.hasViewed);
      if (aUnviewed && !bUnviewed) return -1;
      if (!aUnviewed && bUnviewed) return 1;
      return new Date(b.stories[0].createdAt) - new Date(a.stories[0].createdAt);
    });

    res.json({ success: true, stories: result });
  } catch (error) {
    console.error('getStories error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   POST /api/user/story/view
exports.markStoryViewed = async (req, res) => {
  try {
    const viewerId = req.user && req.user.id;
    if (!viewerId) return res.status(401).json({ success: false, message: 'Authentication required' });
    const { ownerId, storyIndex } = req.body;
    if (!ownerId || typeof storyIndex !== 'number') return res.status(400).json({ success: false, message: 'ownerId and storyIndex required' });

    const owner = await User.findById(ownerId);
    if (!owner) return res.status(404).json({ success: false, message: 'Owner not found' });

    owner.stories = owner.stories || [];
    if (owner.stories[storyIndex]) {
      owner.stories[storyIndex].views = owner.stories[storyIndex].views || [];
      const already = owner.stories[storyIndex].views.some(v => String(v.userId) === String(viewerId));
      if (!already) {
        owner.stories[storyIndex].views.push({ userId: viewerId, viewedAt: new Date() });
        await owner.save();
      }
      return res.json({ success: true });
    }

    res.status(404).json({ success: false, message: 'Story not found' });
  } catch (error) {
    console.error('markStoryViewed error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   PUT /api/user/profile
exports.updateProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'No user context' });
    }
    const { username, name, location, bio, socialLinks } = req.body;
    const existingUser = await User.findById(req.user.id).select('username name');
    const updateData = {};

    if (typeof name === 'string') {
      const nextName = name.trim();
      if (nextName.length > 0) {
        updateData.name = nextName;
      }
    }

    if (username) {
      const existing = await User.findOne({ username: username.toLowerCase(), _id: { $ne: req.user.id } });
      if (existing) return res.status(400).json({ success: false, message: 'Username already taken' });
      updateData.username = username.toLowerCase();
    }
    if (location !== undefined) updateData.location = location;
    if (bio !== undefined) updateData.bio = bio;

    if (socialLinks !== undefined) {
      if (!Array.isArray(socialLinks)) {
        return res.status(400).json({ success: false, message: 'Social links must be an array' });
      }

      const normalizeLink = (link) => {
        let value = String(link).trim();
        if (!value) return '';
        if (!/^https?:\/\//i.test(value)) {
          value = `https://${value}`;
        }
        return value;
      };

      const cleanedLinks = socialLinks
        .map(normalizeLink)
        .filter((link) => link)
        .slice(0, 3);

      const invalidLink = cleanedLinks.find((link) => !/^https?:\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&:/~+#-]*)?$/.test(link));
      if (invalidLink) {
        return res.status(400).json({ success: false, message: 'One or more social links are invalid' });
      }

      updateData.socialLinks = cleanedLinks;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (username && existingUser && existingUser.username !== updateData.username) {
      try { await notifyUser({ userId: user._id, type: 'NAME_CHANGED', title: 'Name Changed', message: 'Your account name was successfully changed.' }); } catch (notificationError) { console.error('Name notification error:', notificationError); }
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('updateProfile error:', error);
    res.status(500).json({ success: false, message: 'Update failed' });
  }
};

// @route   GET /api/user/profile  
exports.getUserProfile = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });
    
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    res.json({ success: true, user: user.getPublicProfile ? user.getPublicProfile() : user.toObject() });
  } catch (error) {
    console.error('getUserProfile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   GET /api/user/my-posts
exports.getUserPosts = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const posts = await Post.find({ user: req.user.id }).populate('user', 'username avatar').sort({ createdAt: -1 });
    res.json({ success: true, posts });
  } catch (error) {
    console.error('getUserPosts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   GET /api/user/saved
exports.getSavedPosts = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const user = await User.findById(req.user.id).populate({
      path: 'savedPosts',
      populate: { path: 'user', select: 'username avatar' },
      select: 'description price houseImages videoUrl videoThumbnail mediaUrl imageUrl location createdAt category productName user'
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, posts: user.savedPosts || [] });
  } catch (error) {
    console.error('getSavedPosts error:', error);
    res.status(500).json({ success: false, message: 'Server error', details: error.message });
  }
};

exports.getAllSavedPosts = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const savedEntries = await SavedPost.find({})
      .populate({
        path: 'post',
        populate: { path: 'user', select: 'username avatar' },
      })
      .populate('user', 'username avatar')
      .sort({ savedAt: -1 });

    const uniquePosts = new Map();
    for (const entry of savedEntries) {
      if (!entry.post) continue;
      const id = entry.post._id.toString();
      if (!uniquePosts.has(id)) {
        uniquePosts.set(id, {
          ...entry.post.toObject(),
          savedBy: entry.user?._id || null,
          saverUsername: entry.user?.username || null,
        });
      }
    }

    res.json({ success: true, posts: [...uniquePosts.values()] });
  } catch (error) {
    console.error('getAllSavedPosts error:', error);
    res.status(500).json({ success: false, message: 'Server error', details: error.message });
  }
};

exports.getUserSavedPosts = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const targetUserId = req.params.userId;
    const user = await User.findById(targetUserId).populate({
      path: 'savedPosts',
      populate: { path: 'user', select: 'username avatar' },
      select: 'description price houseImages videoUrl videoThumbnail mediaUrl imageUrl location createdAt category productName user'
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, posts: user.savedPosts || [] });
  } catch (error) {
    console.error('getUserSavedPosts error:', error);
    res.status(500).json({ success: false, message: 'Server error', details: error.message });
  }
};

// @route   POST|DELETE /api/user/save/:postId
exports.toggleSavePost = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const postId = req.params.postId;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const savedSet = new Set(user.savedPosts.map(id => id.toString()));
    if (savedSet.has(postId)) {
      user.savedPosts = user.savedPosts.filter(id => id.toString() !== postId);
      await user.save();
      res.json({ success: true, saved: false, message: 'Unsaved' });
    } else {
      user.savedPosts.push(postId);
      await user.save();
      res.json({ success: true, saved: true, message: 'Saved' });
    }
  } catch (error) {
    console.error('toggleSavePost error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   POST /api/user/status
exports.updateOnlineStatus = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const user = await User.findByIdAndUpdate(
      req.user.id, 
      { isOnline: true, lastSeen: new Date() }, 
      { new: true }
    ).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    console.error('updateOnlineStatus error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   GET /api/user/status/:userId
exports.getUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('isOnline lastSeen username avatar');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const now = Date.now();
    const lastSeen = user.lastSeen ? new Date(user.lastSeen).getTime() : 0;
    const isOnlineDerived = (now - lastSeen) < 45000; // 45 seconds
    res.json({ success: true, isOnline: isOnlineDerived, lastSeen: user.lastSeen, user: user });
  } catch (error) {
    console.error('getUserStatus error:', error);
    res.status(500).json({ success: false, message: 'Server error', details: error.message });
  }
};

// @route   DELETE /api/user/avatar
exports.deleteAvatar = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const currentUser = await User.findById(req.user.id).select('avatarStorageKey');
    if (!currentUser) return res.status(404).json({ success: false, message: 'User not found' });
    const storageKey = currentUser.avatarStorageKey;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { avatar: '', avatarStorageKey: '' } },
      { new: true }
    ).select('-password');
    if (storageKey) await storageService.deleteMedia(storageKey).catch(error => {
      console.error('[Storage] Avatar deletion failed:', error.code || 'B2_OPERATION_FAILED');
    });
    res.json({ success: true, user });
  } catch (error) {
    console.error('deleteAvatar error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   GET /api/user/:userId
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('username avatar name bio location socialLinks followers following');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error('GET USER BY ID ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------- In-memory online status endpoints ----------

// @route   POST /api/user/online
// @desc    Set current user's online status (in-memory store + DB)
exports.updateOnlineStatusInMemory = async (req, res) => {
  try {
    const { isOnline: online } = req.body;
    if (typeof online !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isOnline must be boolean' });
    }
    const userId = req.user.id;
    setOnline(userId, online);
    await User.findByIdAndUpdate(userId, { isOnline: online, lastSeen: online ? null : new Date() });
    res.json({ success: true });
  } catch (error) {
    console.error('updateOnlineStatusInMemory error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   GET /api/user/:userId/online
// @desc    Get online status of another user (from in-memory store)
exports.getOnlineStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });
    const status = isOnline(userId);
    res.json({ success: true, isOnline: status.isOnline, lastSeen: status.lastSeen });
  } catch (error) {
    console.error('getOnlineStatus error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ========== 🔥 NEW: Upgrade User Plan ==========
// @route   POST /api/user/upgrade
// @desc    Upgrade user subscription plan
// 🔥 Updated: Upgrade user plan with logging and case-insensitive support
exports.upgradePlan = async (req, res) => {
  try {
    console.log('📤 Upgrade request body:', req.body);
    console.log('📤 Plan received:', req.body.plan);

    const userId = req.user.id;
    let { plan, amount, paymentMethod, transactionId } = req.body;

    // Normalize plan: trim, lowercase
    if (plan) {
      plan = plan.trim().toLowerCase();
    } else {
      console.error('❌ Plan is missing from request body');
      return res.status(400).json({ success: false, message: 'Plan is required' });
    }

    // Plan details mapping
    const planDetails = {
      standard: { amount: 200, name: 'Standard' },
      premium: { amount: 500, name: 'Premium' },
      business: { amount: 5000, name: 'Business' },
      enterprise: { amount: 20000, name: 'Enterprise' },
    };

    // Also allow mapping from plan names (e.g., 'Standard' → 'standard')
    const nameToKey = {
      standard: 'standard',
      premium: 'premium',
      business: 'business',
      enterprise: 'enterprise',
    };

    // If the provided plan is not a direct key, try to map from name
    let planKey = nameToKey[plan] || plan;
    const selectedPlan = planDetails[planKey];

    if (!selectedPlan) {
      console.error('❌ Invalid plan received:', plan);
      return res.status(400).json({
        success: false,
        message: 'Invalid plan selected. Available plans: standard, premium, business, enterprise',
      });
    }

    // Validate amount matches plan (if amount is provided)
    if (amount && Number(amount) !== selectedPlan.amount) {
      return res.status(400).json({
        success: false,
        message: `Amount does not match ${selectedPlan.name} plan (expected ${selectedPlan.amount} RWF)`,
      });
    }

    // Create payment entry
    const payment = {
      plan: planKey,
      planName: selectedPlan.name,
      amount: selectedPlan.amount,
      currency: 'RWF',
      transactionId: transactionId || `TXN-${Date.now()}`,
      paymentMethod: paymentMethod || 'MTN MoMo',
      paymentDate: new Date(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      status: 'success',
    };

    // Update user
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $push: { paymentHistory: payment },
        $set: {
          plan: planKey,
          planName: selectedPlan.name,
          planExpiry: payment.expiryDate,
          subscriptionStatus: 'active',
          planStartDate: new Date(),
          dailyMessagesUsed: 0,
          messagesLastReset: new Date(),
        },
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log(`✅ User ${userId} upgraded to ${selectedPlan.name} plan`);
    res.status(200).json({
      success: true,
      message: `Upgraded to ${selectedPlan.name} plan successfully`,
      user,
    });
  
  
  } catch (error) {
    console.error('❌ Upgrade plan error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};