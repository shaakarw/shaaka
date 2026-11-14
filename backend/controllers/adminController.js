// controllers/adminController.js
const User = require('../models/User');
const Post = require('../models/Post');
const Place = require('../models/Place');
const MallShop = require('../models/MallShop');
const Report = require('../models/Report');
const BusinessIdea = require('../models/BusinessIdea');
const { isValidObjectId } = require('../utils/objectId');
const { computeAggregatedLimits, getActiveSubscriptions } = require('../utils/subscriptionHelpers_clean');
const { deleteMallShopWithCleanup, deleteShopWithCleanup } = require('../utils/deletionCleanup');
const {
  getDailyUsage,
  getLifetimeUsage,
  getNextDailyReset,
} = require('../utils/permissionUsage');

// -------- DASHBOARD STATISTICS --------
exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalPosts = await Post.countDocuments();
    const [placeShops, mallShops] = await Promise.all([
      Place.countDocuments({ $or: [{ category: 'shop' }, { type: 'shop' }] }),
      MallShop.countDocuments(),
    ]);
    const totalShops = placeShops + mallShops;
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
      videoUrl: p.videoUrl || '',
      videoHlsUrl: p.videoHlsUrl || '',
      videoThumbnail: p.videoThumbnail || '',
      videoDuration: p.videoDuration || 0,
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
    const [placeShops, mallShops] = await Promise.all([
      Place.find({ $or: [{ category: 'shop' }, { type: 'shop' }] })
        .populate('userId', 'username phone avatar')
        .sort({ createdAt: -1 }),
      MallShop.find()
        .populate('ownerId', 'username phone avatar')
        .sort({ createdDate: -1 }),
    ]);
    const formattedPlaces = placeShops.map(s => ({
      _id: s._id,
      name: s.name,
      location: s.address?.full || [
        s.address?.district,
        s.address?.sector,
        s.address?.cell,
        s.address?.street,
      ].filter(Boolean).join(', '),
      phone: s.contact?.phone || '',
      image: s.images?.streetImage || s.images?.street || s.images?.doorImage || '',
      isMallShop: false,
      status: s.status || 'active',
      stopped: s.stopped || false,
      owner: s.userId ? { username: s.userId.username, phone: s.userId.phone, avatar: s.userId.avatar } : null,
      ownerName: s.userId ? s.userId.username : 'Unknown',
      createdAt: s.createdAt,
    }));
    const formattedMallShops = mallShops.map(s => ({
      _id: s._id,
      name: s.name,
      location: [s.mallName, s.address].filter(Boolean).join(', '),
      mallName: s.mallName || '',
      phone: s.phone || '',
      image: s.images?.frontImage || '',
      isMallShop: true,
      status: 'active',
      stopped: false,
      owner: s.ownerId ? { username: s.ownerId.username, phone: s.ownerId.phone, avatar: s.ownerId.avatar } : null,
      ownerName: s.ownerId ? (s.ownerId.username || s.ownerId.name) : 'Unknown',
      createdAt: s.createdDate,
    }));
    res.json({ success: true, shops: [...formattedPlaces, ...formattedMallShops] });
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

exports.deleteMallShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    const shop = await MallShop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }

    await deleteMallShopWithCleanup(shopId);
    res.json({ success: true, message: 'Mall shop and related data deleted successfully' });
  } catch (err) {
    console.error('Delete mall shop error:', err);
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

const cleanText = (value, maxLength = 5000) => (
  typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
);

const cleanStringList = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().slice(0, 500))
    .filter(Boolean)
    .slice(0, 30);
};

const isValidEstimatedAmount = (value) => {
  const amount = '(?:\\d+|\\d{1,3}(?:,\\d{3})+)(?:\\.\\d{1,2})?';
  const currency = '(?:RWF|USD|EUR|UGX|KES|[$€£])';
  return new RegExp(`^(?:${currency}\\s*)?${amount}(?:\\s*(?:-|–|to)\\s*(?:${currency}\\s*)?${amount})?(?:\\s*${currency})?$`, 'i').test(value);
};

const normalizeManagedIdea = (body, adminId) => {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const data = {
    name: cleanText(input.name, 120),
    category: 'business',
    businessCategory: cleanText(input.businessCategory, 80),
    description: cleanText(input.description, 800),
    fullDescription: cleanText(input.fullDescription, 10000),
    cost: cleanText(input.cost, 80),
    profit: cleanText(input.profit, 80),
    risk: cleanText(input.risk, 30),
    time: cleanText(input.time, 80),
    steps: cleanStringList(input.steps),
    targetAudience: cleanText(input.targetAudience, 500),
    requiredSkills: cleanStringList(input.requiredSkills),
    equipment: cleanStringList(input.equipment),
    potentialCustomers: cleanStringList(input.potentialCustomers),
    marketingStrategy: cleanText(input.marketingStrategy, 2000),
    challenges: cleanStringList(input.challenges),
    location: cleanText(input.location, 300),
    additionalInfo: cleanText(input.additionalInfo, 3000),
    published: input.published === true,
  };
  const errors = {};
  [
    ['name', 'Business name is required'],
    ['description', 'Short description is required'],
    ['fullDescription', 'Full description is required'],
    ['businessCategory', 'Business category is required'],
    ['cost', 'Estimated startup cost is required'],
    ['profit', 'Estimated monthly profit is required'],
    ['risk', 'Risk level is required'],
    ['time', 'Estimated launch time is required'],
  ].forEach(([field, message]) => {
    if (!data[field]) errors[field] = message;
  });
  if (data.name.length < 2) errors.name = 'Business name must contain at least 2 characters';
  if (!['Low', 'Medium', 'High'].includes(data.risk)) {
    errors.risk = 'Risk level must be Low, Medium, or High';
  }
  if (data.cost && !isValidEstimatedAmount(data.cost)) {
    errors.cost = 'Enter a valid non-negative amount';
  }
  if (data.profit && !isValidEstimatedAmount(data.profit)) {
    errors.profit = 'Enter a valid non-negative amount';
  }
  if (data.steps.length === 0) errors.steps = 'Add at least one starting step';
  if (input.published !== undefined && typeof input.published !== 'boolean') {
    errors.published = 'Publication status must be true or false';
  }
  return { data: { ...data, updatedBy: adminId }, errors };
};

const getBusinessIdeaFilter = (query) => {
  const filter = { category: { $nin: ['job', 'skill'] } };
  if (query.status === 'published') filter.published = { $ne: false };
  if (query.status === 'draft') filter.published = false;
  if (typeof query.category === 'string' && query.category.trim()) {
    filter.businessCategory = query.category.trim().slice(0, 80);
  }
  if (typeof query.search === 'string' && query.search.trim()) {
    const escaped = query.search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (escaped) {
      const expression = new RegExp(escaped, 'i');
      filter.$or = [
        { name: expression },
        { description: expression },
        { fullDescription: expression },
        { businessCategory: expression },
      ];
    }
  }
  return filter;
};

exports.getManagedBusinessIdeas = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const filter = getBusinessIdeaFilter(req.query);
    const sortField = req.query.sort === 'oldest' ? 'createdAt' : req.query.sort === 'name' ? 'name' : 'createdAt';
    const sortDirection = req.query.sort === 'oldest' || req.query.sort === 'name' ? 1 : -1;
    const businessFilter = { category: { $nin: ['job', 'skill'] } };
    const recentSince = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
    const [businessIdeas, total, totalIdeas, publishedIdeas, draftIdeas, recentIdeas, categories] = await Promise.all([
      BusinessIdea.find(filter).sort({ [sortField]: sortDirection }).skip((page - 1) * limit).limit(limit).lean(),
      BusinessIdea.countDocuments(filter),
      BusinessIdea.countDocuments(businessFilter),
      BusinessIdea.countDocuments({ ...businessFilter, published: { $ne: false } }),
      BusinessIdea.countDocuments({ ...businessFilter, published: false }),
      BusinessIdea.countDocuments({ ...businessFilter, createdAt: { $gte: recentSince } }),
      BusinessIdea.distinct('businessCategory', businessFilter),
    ]);
    res.json({
      success: true,
      businessIdeas,
      pagination: { page, limit, total, hasMore: page * limit < total },
      stats: { total: totalIdeas, published: publishedIdeas, drafts: draftIdeas, recent: recentIdeas },
      categories: categories.filter(Boolean).sort(),
    });
  } catch (err) {
    console.error('Get managed business ideas error:', err.message);
    res.status(500).json({ success: false, message: 'Could not load business ideas' });
  }
};

exports.getManagedBusinessIdea = async (req, res) => {
  if (!isValidObjectId(req.params.ideaId)) {
    return res.status(400).json({ success: false, message: 'Invalid business idea ID' });
  }
  try {
    const businessIdea = await BusinessIdea.findOne({
      _id: req.params.ideaId,
      category: { $nin: ['job', 'skill'] },
    });
    if (!businessIdea) return res.status(404).json({ success: false, message: 'Business idea not found' });
    res.json({ success: true, businessIdea });
  } catch (err) {
    console.error('Get managed business idea error:', err.message);
    res.status(500).json({ success: false, message: 'Could not load business idea' });
  }
};

exports.createManagedBusinessIdea = async (req, res) => {
  const { data, errors } = normalizeManagedIdea(req.body, req.adminUser._id);
  if (Object.keys(errors).length) {
    return res.status(400).json({ success: false, message: 'Please correct the highlighted fields', errors });
  }
  try {
    const businessIdea = await BusinessIdea.create({
      ...data,
      createdBy: req.adminUser._id,
    });
    res.status(201).json({ success: true, message: 'Business idea created', businessIdea });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: 'Business idea data is invalid' });
    }
    console.error('Create managed business idea error:', err.message);
    res.status(500).json({ success: false, message: 'Could not create business idea' });
  }
};

exports.updateManagedBusinessIdea = async (req, res) => {
  if (!isValidObjectId(req.params.ideaId)) {
    return res.status(400).json({ success: false, message: 'Invalid business idea ID' });
  }
  const { data, errors } = normalizeManagedIdea(req.body, req.adminUser._id);
  if (Object.keys(errors).length) {
    return res.status(400).json({ success: false, message: 'Please correct the highlighted fields', errors });
  }
  try {
    const businessIdea = await BusinessIdea.findOneAndUpdate(
      { _id: req.params.ideaId, category: { $nin: ['job', 'skill'] } },
      data,
      { new: true, runValidators: true }
    );
    if (!businessIdea) return res.status(404).json({ success: false, message: 'Business idea not found' });
    res.json({ success: true, message: 'Business idea updated', businessIdea });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: 'Business idea data is invalid' });
    }
    console.error('Update managed business idea error:', err.message);
    res.status(500).json({ success: false, message: 'Could not update business idea' });
  }
};

exports.updateManagedBusinessIdeaStatus = async (req, res) => {
  if (!isValidObjectId(req.params.ideaId)) {
    return res.status(400).json({ success: false, message: 'Invalid business idea ID' });
  }
  if (typeof req.body?.published !== 'boolean') {
    return res.status(400).json({ success: false, message: 'Publication status must be true or false' });
  }
  try {
    const businessIdea = await BusinessIdea.findOneAndUpdate(
      { _id: req.params.ideaId, category: { $nin: ['job', 'skill'] } },
      { $set: { published: req.body.published, updatedBy: req.adminUser._id } },
      { new: true, runValidators: true }
    );
    if (!businessIdea) return res.status(404).json({ success: false, message: 'Business idea not found' });
    res.json({ success: true, message: 'Publication status updated', businessIdea });
  } catch (err) {
    console.error('Update business idea status error:', err.message);
    res.status(500).json({ success: false, message: 'Could not update publication status' });
  }
};

exports.deleteManagedBusinessIdea = async (req, res) => {
  if (!isValidObjectId(req.params.ideaId)) {
    return res.status(400).json({ success: false, message: 'Invalid business idea ID' });
  }
  try {
    const businessIdea = await BusinessIdea.findOneAndDelete({
      _id: req.params.ideaId,
      category: { $nin: ['job', 'skill'] },
    });
    if (!businessIdea) return res.status(404).json({ success: false, message: 'Business idea not found' });
    res.json({ success: true, message: 'Business idea deleted' });
  } catch (err) {
    console.error('Delete managed business idea error:', err.message);
    res.status(500).json({ success: false, message: 'Could not delete business idea' });
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
    const updates = {};
    const numericPermissions = [
      'postUploadLimitPerDay',
      'shopUploadLimitLifetime',
      'placeProductUploadLimitPerDay',
      'mallShopUploadLimitLifetime',
      'mallProductUploadLimitPerDay',
      'imagesPerMessage',
      'imagesRetentionDays',
      'messagesRetentionDays',
      'videoUploadLimitPerDay',
    ];
    for (const key of numericPermissions) {
      if (!Object.prototype.hasOwnProperty.call(req.body || {}, key)) continue;
      const value = req.body[key];
      if (!Number.isSafeInteger(value) || value < 0 || value > 100) {
        return res.status(400).json({
          success: false,
          message: `${key} must be a whole number between 0 and 100.`,
        });
      }
      updates[key] = value;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'allowVideoUpload')) {
      if (typeof req.body.allowVideoUpload !== 'boolean') {
        return res.status(400).json({ success: false, message: 'allowVideoUpload must be a boolean.' });
      }
      updates.allowVideoUpload = req.body.allowVideoUpload;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'At least one valid permission must be provided.' });
    }

    const user = await User.findByIdAndUpdate(userId, updates, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    try {
      const io = require('../socket').getIO();
      if (io) io.to(String(user._id)).emit('user-permissions-updated');
    } catch (socketError) {
      console.error('Could not notify user about updated permissions:', socketError.message || socketError);
    }
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

    const now = new Date();
    const [
      postsToday,
      videosToday,
      placeProductsToday,
      mallProductsToday,
      shopsPlacesUsed,
      mallShopsUsed,
    ] = await Promise.all([
      getDailyUsage(userId, 'posts', now),
      getDailyUsage(userId, 'videos', now),
      getDailyUsage(userId, 'place_products', now),
      getDailyUsage(userId, 'mall_products', now),
      getLifetimeUsage(userId, 'shops_places'),
      getLifetimeUsage(userId, 'mall_shops'),
    ]);
    const dailyResetAt = getNextDailyReset(now);

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
      maxShops: user.shopUploadLimitLifetime,
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
    const videoLimit = typeof user.videoUploadLimitPerDay === 'number'
      ? Math.max(0, user.videoUploadLimitPerDay)
      : totalLimits.videoUploadsPerDay;

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
      placeProductUploadLimitPerDay: user.placeProductUploadLimitPerDay,
      placeProductsToday,
      remainingPlaceProducts: Math.max(user.placeProductUploadLimitPerDay - placeProductsToday, 0),
      mallProductUploadLimitPerDay: user.mallProductUploadLimitPerDay,
      mallProductsToday,
      remainingMallProducts: Math.max(user.mallProductUploadLimitPerDay - mallProductsToday, 0),
      shopUploadLimitLifetime: user.shopUploadLimitLifetime,
      shopsPlacesUsed,
      mallShopUploadLimitLifetime: user.mallShopUploadLimitLifetime,
      mallShopsUsed,
      imagesRetentionDays: user.imagesRetentionDays,
      messagesRetentionDays: user.messagesRetentionDays,
      dailyResetAt: dailyResetAt.toISOString(),
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