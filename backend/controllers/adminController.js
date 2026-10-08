// controllers/adminController.js
const User = require('../models/User');
const Post = require('../models/Post');
const Place = require('../models/Place');
const Report = require('../models/Report');
const BusinessIdea = require('../models/BusinessIdea');
const { computeAggregatedLimits, getActiveSubscriptions } = require('../utils/subscriptionHelpers_clean');
const { deleteShopWithCleanup } = require('../utils/deletionCleanup');

// -------- DASHBOARD STATISTICS --------
exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalPosts = await Post.countDocuments();
    const totalShops = await Place.countDocuments({ type: 'shop' });
    const totalReports = await Report.countDocuments();

    const blockedUsers = await User.countDocuments({ blocked: true });
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const activityStart = new Date(today);
    activityStart.setUTCDate(activityStart.getUTCDate() - 29);
    const dailyPosts = await Post.aggregate([
      { $match: { createdAt: { $gte: activityStart } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
          value: { $sum: 1 },
        },
      },
    ]);
    const postsByDay = new Map(dailyPosts.map((entry) => [entry._id, entry.value]));
    const activityHistory = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(activityStart);
      date.setUTCDate(date.getUTCDate() + index);
      return {
        date: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
        value: postsByDay.get(date.toISOString().slice(0, 10)) || 0,
      };
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalPosts,
        totalShops,
        totalReports,
        blockedUsers,
        activityHistory,
      }
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// -------- USERS --------
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    await User.findByIdAndDelete(userId);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndUpdate(userId, { blocked: true }, { new: true, select: '-password' });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User blocked', user });
  } catch (err) {
    console.error('Block user error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndUpdate(userId, { blocked: false }, { new: true, select: '-password' });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User unblocked', user });
  } catch (err) {
    console.error('Unblock user error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// -------- POSTS --------
exports.getPosts = async (req, res) => {
  try {
    const posts = await Post.find().populate('user', 'username phone avatar').sort({ createdAt: -1 });
    const formatted = posts.map(p => ({
      _id: p._id,
      title: p.productName || p.title || 'Untitled',
      productName: p.productName,
      description: p.description,
      location: p.location,
      houseImages: p.houseImages || [],
      price: p.price,
      featured: p.featured || false,
      trending: p.trending || false,
      status: p.status || 'active',
      isReported: p.isReported || false,
      stopped: p.stopped || false,
      owner: p.user ? { username: p.user.username, phone: p.user.phone, avatar: p.user.avatar } : null,
      ownerName: p.user ? p.user.username : 'Unknown',
      createdAt: p.createdAt,
    }));
    res.json({ success: true, posts: formatted });
  } catch (err) {
    console.error('Get posts error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const { deletePostWithCleanup } = require('../utils/deletionCleanup');
    await deletePostWithCleanup(postId);

    res.json({ success: true, message: 'Post and all related data deleted successfully' });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.stopPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findByIdAndUpdate(postId, { stopped: true }, { new: true });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, message: 'Post stopped', post });
  } catch (err) {
    console.error('Stop post error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.restorePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findByIdAndUpdate(postId, { stopped: false }, { new: true });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, message: 'Post restored', post });
  } catch (err) {
    console.error('Restore post error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// -------- SHOPS (Place) --------
exports.getShops = async (req, res) => {
  try {
    const shops = await Place.find({ type: 'shop' }).populate('userId', 'username phone avatar').sort({ createdAt: -1 });
    const formatted = shops.map(s => ({
      _id: s._id,
      name: s.name,
      location: s.location,
      status: s.status || 'active',
      stopped: s.stopped || false,
      owner: s.userId ? { username: s.userId.username, phone: s.userId.phone, avatar: s.userId.avatar } : null,
      ownerName: s.userId ? s.userId.username : 'Unknown',
      createdAt: s.createdAt,
    }));
    res.json({ success: true, shops: formatted });
  } catch (err) {
    console.error('Get shops error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    const place = await Place.findById(shopId);
    if (!place) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }

    await deleteShopWithCleanup(shopId);

    res.json({ success: true, message: 'Shop and all related data deleted successfully' });
  } catch (err) {
    console.error('Delete shop error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.stopShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    const shop = await Place.findByIdAndUpdate(shopId, { stopped: true }, { new: true });
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
    res.json({ success: true, message: 'Shop stopped', shop });
  } catch (err) {
    console.error('Stop shop error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.restoreShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    const shop = await Place.findByIdAndUpdate(shopId, { stopped: false }, { new: true });
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
    res.json({ success: true, message: 'Shop restored', shop });
  } catch (err) {
    console.error('Restore shop error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// -------- BUSINESS IDEAS --------
exports.createBusinessIdea = async (req, res) => {
  try {
    const { name, category, description, cost, profit, risk, time, steps } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Business idea name is required' });
    }

    const normalizedSteps = Array.isArray(steps)
      ? steps.filter((step) => typeof step === 'string' && step.trim())
      : typeof steps === 'string'
      ? steps.split(/\r?\n|,/).map((step) => step.trim()).filter(Boolean)
      : [];

    const businessIdea = await BusinessIdea.create({
      name: name.trim(),
      category: category ? category.trim() : '',
      description: description ? description.trim() : '',
      cost: cost ? cost.trim() : '',
      profit: profit ? profit.trim() : '',
      risk: risk ? risk.trim() : '',
      time: time ? time.trim() : '',
      steps: normalizedSteps,
      createdBy: req.adminUser._id,
    });

    res.status(201).json({ success: true, message: 'Business idea created', businessIdea });
  } catch (err) {
    console.error('Create business idea error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// -------- REPORTS (CORRECTED) --------
exports.getReports = async (req, res) => {
  try {
    const reports = await Report.find()
      .populate('reporter', 'username phone avatar')   // ✅ schema field is 'reporter'
      .populate('post')                                // ✅ schema field is 'post' (populate all)
      .sort({ createdAt: -1 });

    const formatted = reports.map(r => ({
      _id: r._id,
      reason: r.reason,
      createdAt: r.createdAt,
      reporter: r.reporter
        ? {
            username: r.reporter.username,
            phone: r.reporter.phone,
            avatar: r.reporter.avatar,
          }
        : null,
      reporterName: r.reporter ? r.reporter.username : 'Unknown',
      post: r.post
        ? {
            _id: r.post._id,
            title: r.post.productName || r.post.title || 'Untitled',
            productName: r.post.productName,
            description: r.post.description,
            location: r.post.location,
            price: r.post.price,
            amount: r.post.amount,
            houseImages: r.post.houseImages || [],
            contactNumbers: r.post.contactNumbers || [],
            username:
              r.post.username ||
              (r.post.user && r.post.user.username) ||
              'Unknown',
            userAvatar:
              r.post.userAvatar ||
              (r.post.user && r.post.user.avatar) ||
              null,
            status: r.post.status,
            priceNegotiable: r.post.priceNegotiable || false,
            userId: r.post.user?._id || r.post.user,
            createdAt: r.post.createdAt,
          }
        : null,   // post was deleted
      postTitle: r.post
        ? r.post.productName || r.post.title || 'Untitled'
        : 'Unknown post',
      ignored: r.ignored || false,
      status: r.status || 'pending',
    }));

    res.json({ success: true, reports: formatted });
  } catch (err) {
    console.error('Get reports error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.ignoreReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await Report.findByIdAndUpdate(reportId, { ignored: true, status: 'ignored' }, { new: true });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, message: 'Report ignored', report });
  } catch (err) {
    console.error('Ignore report error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Payments have been removed from the system. This endpoint is disabled.
exports.getPayments = async (req, res) => {
  res.status(410).json({ success: false, message: 'Payments have been removed from this application.' });
};

// -------- ADMIN: Update user upload limits & permissions --------
exports.updateUserLimits = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      postUploadLimitPerDay,
      shopUploadLimitLifetime,
      placeProductUploadLimitPerDay,
      mallShopUploadLimitLifetime,
      mallProductUploadLimitPerDay,
      imagesPerMessage,
      imagesRetentionDays,
      messagesRetentionDays,
      allowVideoUpload,
      videoUploadLimitPerDay,
    } = req.body;
    const updates = {};
    const clampLimit = (value) => Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

    if (typeof postUploadLimitPerDay === 'number') updates.postUploadLimitPerDay = clampLimit(postUploadLimitPerDay);
    if (typeof shopUploadLimitLifetime === 'number') updates.shopUploadLimitLifetime = clampLimit(shopUploadLimitLifetime);
    if (typeof placeProductUploadLimitPerDay === 'number') updates.placeProductUploadLimitPerDay = clampLimit(placeProductUploadLimitPerDay);
    if (typeof mallShopUploadLimitLifetime === 'number') updates.mallShopUploadLimitLifetime = clampLimit(mallShopUploadLimitLifetime);
    if (typeof mallProductUploadLimitPerDay === 'number') updates.mallProductUploadLimitPerDay = clampLimit(mallProductUploadLimitPerDay);
    if (typeof imagesPerMessage === 'number') updates.imagesPerMessage = clampLimit(imagesPerMessage);
    if (typeof imagesRetentionDays === 'number') updates.imagesRetentionDays = clampLimit(imagesRetentionDays);
    if (typeof messagesRetentionDays === 'number') updates.messagesRetentionDays = clampLimit(messagesRetentionDays);
    if (typeof allowVideoUpload === 'boolean') updates.allowVideoUpload = allowVideoUpload;
    if (typeof videoUploadLimitPerDay === 'number') updates.videoUploadLimitPerDay = clampLimit(videoUploadLimitPerDay);

    const user = await User.findByIdAndUpdate(userId, updates, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User limits updated', user });
  } catch (err) {
    console.error('Update user limits error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// -------- ADMIN: Trigger message retention cleanup --------
exports.cleanupOldMessages = async (req, res) => {
  try {
    const { cleanupOldMessages } = require('../utils/messageRetention');
    const result = await cleanupOldMessages({ dryRun: false });
    res.json({ success: true, message: 'Cleanup completed', result });
  } catch (err) {
    console.error('Cleanup old messages error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
// -------- USER DETAILS (including aggregated subscription limits) --------
exports.getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Post and Shop stats
    const totalPosts = await Post.countDocuments({ user: userId });
    const activePosts = await Post.countDocuments({ user: userId, status: 'active' });
    const stoppedPosts = await Post.countDocuments({ user: userId, status: 'stopped' });

    const shops = await Place.find({ userId, type: 'shop' });
    const totalShops = shops.length;
    const totalShopImages = shops.reduce((acc, shop) => acc + (shop.images ? shop.images.length : 0), 0);

    // ✅ Compute aggregated limits from active subscriptions
    const totalLimits = computeAggregatedLimits(user);
    const activeSubscriptions = getActiveSubscriptions(user);

    // Today's posts (for usage stats)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const postsToday = await Post.countDocuments({
      user: userId,
      createdAt: { $gte: today, $lt: tomorrow }
    });

    // Payment summary
    let totalPaid = 0, paymentCount = 0, lastPayment = null, firstPayment = null;
    if (user.paymentHistory && user.paymentHistory.length > 0) {
      const sorted = [...user.paymentHistory].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
      lastPayment = sorted[0];
      firstPayment = sorted[sorted.length - 1];
      user.paymentHistory.forEach(p => {
        if (p.status === 'success') {
          totalPaid += p.amount;
          paymentCount++;
        }
      });
    }

    const userData = user.toObject();
    userData.postsTotal = totalPosts;
    userData.activePosts = activePosts;
    userData.stoppedPosts = stoppedPosts;
    userData.shops = {
      total: totalShops,
      maxShops: 1,
      totalImages: totalShopImages,
      maxImages: totalLimits.shopImages, // ✅ from aggregated
    };

    // Subscription info (legacy fields + some derived)
    userData.subscription = {
      plan: user.plan || 'free',
      planName: user.planName || 'Free',
      status: user.subscriptionStatus || 'active',
      amountPaid: lastPayment ? lastPayment.amount : 0,
      paymentMethod: lastPayment ? (lastPayment.paymentMethod || 'MTN MoMo') : '',
      transactionId: lastPayment ? (lastPayment.transactionId || '') : '',
      paymentDate: lastPayment ? lastPayment.paymentDate : null,
      startDate: firstPayment ? firstPayment.paymentDate : null,
      expiryDate: user.planExpiry || null,
      daysRemaining: user.planExpiry ? Math.ceil((new Date(user.planExpiry) - new Date()) / (1000 * 60 * 60 * 24)) : -1,
      lastPaymentDate: lastPayment ? lastPayment.paymentDate : null,
      nextRenewalDate: user.planExpiry || null,
      numberOfPayments: paymentCount,
      totalPaid,
    };

    // ✅ Limits from aggregated subscriptions
    const videoLimit = typeof user.videoUploadLimitPerDay === 'number' ? Math.max(0, user.videoUploadLimitPerDay) : 0;
    const videosToday = await Post.countDocuments({
      user: userId,
      videoUrl: { $exists: true, $ne: '' },
      createdAt: { $gte: today, $lt: tomorrow }
    });

    userData.limits = {
      postsPerDay: totalLimits.postsPerDay,
      imagesPerMessage: totalLimits.imagesPerMessage,
      shopImages: totalLimits.shopImages,
      retentionDays: totalLimits.retentionDays,
      postsToday,
      remainingPosts: Math.max(totalLimits.postsPerDay - postsToday, 0),
      allowVideoUpload: user.allowVideoUpload !== false,
      videoUploadLimitPerDay: videoLimit,
      videosToday,
      remainingVideos: Math.max(videoLimit - videosToday, 0),
    };

    userData.stats = {
      createdAt: user.createdAt,
      lastSeen: user.lastSeen || null,
    };

    // ✅ Add active subscriptions list and total limits for frontend
    userData.activeSubscriptions = activeSubscriptions;
    userData.totalLimits = totalLimits;

    res.json({ success: true, user: userData });
  } catch (err) {
    console.error('Get user details error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updatePost = async (req, res) => {
  try {
    const updates = {};
    if (typeof req.body?.featured === 'boolean') updates.featured = req.body.featured;
    if (typeof req.body?.trending === 'boolean') updates.trending = req.body.trending;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid post fields provided' });
    }

    const post = await Post.findByIdAndUpdate(req.params.postId, updates, { new: true });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, message: 'Post updated', post });
  } catch (err) {
    console.error('Update post error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};