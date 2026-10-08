// controllers/postController.js
const Post = require('../models/Post');
const User = require('../models/User');
const SavedPost = require('../models/SavedPost');
const storageService = require('../services/storage/storageService');
const { deletePostWithCleanup } = require('../utils/deletionCleanup');
const { normalizeRwandaPhone, isValidRwandaPhone } = require('../utils/phoneNormalizer');
const { notifyUsers } = require('../services/notificationService');

// ----- Import subscription helpers -----
const {
  computeAggregatedLimits,
  getTodayUsageFromDB,
  MAX_IMAGES_PER_POST,
} = require('../utils/subscriptionHelpers_clean');

// ---------- CREATE POST ----------
// @route   POST /api/posts
// @desc    Create a new post (enforces total, cooldown, daily, and lifetime limits)
exports.createPost = async (req, res) => {
  const uploadedStorageKeys = [];
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('phone username avatar paymentHistory postUploadLimitPerDay allowVideoUpload videoUploadLimitPerDay');
    if (!user) {
      console.error('User not found:', userId);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // ----- 1. Compute user's aggregated limits -----
    const limits = computeAggregatedLimits(user);
    console.log('User limits:', limits);

    // ----- 2. Get today's usage (posts & images) from DB -----
    const todayUsage = await getTodayUsageFromDB(Post, userId);
    console.log('Today usage:', todayUsage);

    // ----- 3. Check daily post limit (admin override respected via computeAggregatedLimits) -----
    const remainingPosts = limits.postsPerDay - todayUsage.postsUsed;
    if (remainingPosts <= 0) {
      return res.status(403).json({
        success: false,
        message: 'Daily post limit reached.',
      });
    }

    const imageFiles = (req.files && req.files.images) || [];
    const videoFile = req.files?.video?.[0];

    if (videoFile) {
      if (user.allowVideoUpload !== true) {
        return res.status(403).json({
          success: false,
          message: 'Video uploads are not enabled for this account.',
        });
      }

      const videoLimit = typeof user.videoUploadLimitPerDay === 'number'
        ? Math.max(0, user.videoUploadLimitPerDay)
        : 0;
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startOfTomorrow = new Date(startOfDay);
      startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
      const videosToday = await Post.countDocuments({
        user: userId,
        videoUrl: { $exists: true, $ne: '' },
        createdAt: { $gte: startOfDay, $lt: startOfTomorrow },
      });

      if (videoLimit <= 0 || videosToday >= videoLimit) {
        return res.status(403).json({
          success: false,
          message: 'Daily video upload limit reached.',
        });
      }
    }

    // ----- 6. Parse post data from request -----
    let postDataObj = {};
    if (req.body.postData) {
      try {
        postDataObj = JSON.parse(req.body.postData);
      } catch (e) {
        return res.status(400).json({ success: false, message: 'Invalid post data format' });
      }
    }

    const {
      category = 'other',
      productName,
      bedrooms,
      bathrooms,
      size,
      description,
      location,
      price,
      priceNegotiable,
      contactNumber1,
      contactNumber2,
    } = { ...req.body, ...postDataObj };

    // Validate required fields
    if (!category || !description || !location || !price) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (!contactNumber1 || !contactNumber1.trim()) {
      return res.status(400).json({ success: false, message: 'Call phone number is required' });
    }
    const normalizedContact1 = normalizeRwandaPhone(contactNumber1);
    if (!normalizedContact1) {
      return res.status(400).json({ success: false, message: 'Please enter a valid Rwanda phone number for the call number (e.g. 0781234567)' });
    }

    let normalizedContact2 = '';
    if (contactNumber2 && contactNumber2.trim()) {
      normalizedContact2 = normalizeRwandaPhone(contactNumber2);
      if (!normalizedContact2) {
        return res.status(400).json({ success: false, message: 'Please enter a valid WhatsApp number or leave it empty' });
      }
    }

    const contactNumbers = [normalizedContact1];
    if (normalizedContact2) {
      contactNumbers.push(normalizedContact2);
    }

    if (imageFiles.length === 0 && !videoFile) {
      return res.status(400).json({ success: false, message: 'Please attach at least one image or video to create a post.' });
    }

    const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
    const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
    if (imageFiles.some(file => !file.buffer || file.buffer.length > MAX_IMAGE_BYTES)) {
      return res.status(400).json({ success: false, message: 'One or more images exceed the 3 MB size limit.' });
    }
    if (videoFile && (!videoFile.buffer || videoFile.buffer.length > MAX_VIDEO_BYTES)) {
      return res.status(400).json({ success: false, message: 'Video exceeds the 50 MB size limit.' });
    }

    // ---------- 7. Handle image uploads ----------
    const imageUrls = [];
    const houseImageStorageKeys = [];
    const postId = new Post()._id;
    if (imageFiles.length > 0) {
      // 7a. Check per‑post image limit (constant 2)
      if (imageFiles.length > MAX_IMAGES_PER_POST) {
        return res.status(400).json({
          success: false,
          message: `You can only upload up to ${MAX_IMAGES_PER_POST} images per post.`,
        });
      }

      // Upload each original image without re-encoding or reducing quality.
      for (const file of imageFiles) {
        const result = await storageService.uploadMedia({
          buffer: file.buffer,
          mimeType: file.mimetype,
          folder: `posts/${postId}/images`,
          maxBytes: MAX_IMAGE_BYTES,
        });
        uploadedStorageKeys.push(result.storageKey);
        houseImageStorageKeys.push(result.storageKey);
        imageUrls.push(storageService.getMediaUrl(result.storageKey, {
          origin: storageService.getRequestOrigin(req),
        }));
      }
    }

    // ---------- 8. Build post data ----------
    let videoUrl = '';
    let videoHlsUrl = '';
    let videoThumbnail = '';
    let videoId = '';
    let videoStorageKey = '';
    let uploadedVideoDuration = Number(req.body.videoDuration) || 0;
    if (videoFile) {
      const videoResult = await storageService.uploadMedia({
        buffer: videoFile.buffer,
        mimeType: videoFile.mimetype,
        folder: `posts/${postId}/videos`,
        maxBytes: MAX_VIDEO_BYTES,
      });
      uploadedStorageKeys.push(videoResult.storageKey);
      videoStorageKey = videoResult.storageKey;
      videoId = videoStorageKey;
      videoUrl = storageService.getMediaUrl(videoStorageKey, {
        origin: storageService.getRequestOrigin(req),
      });
      videoHlsUrl = videoUrl;
    }

    const postData = {
      _id: postId,
      user: userId,
      username: user.username,
      userPhone: contactNumber1,
      userAvatar: user.avatar || '',
      category,
      description,
      location,
      price: Number(price),
      priceNegotiable: priceNegotiable === 'true' || priceNegotiable === true,
      contactNumbers,
      houseImages: imageUrls,
      houseImageStorageKeys,
      storageProvider: 'b2',
      videoUrl,
      videoHlsUrl,
      videoId,
      videoStorageKey,
      videoDuration: uploadedVideoDuration,
      videoThumbnail,
      videoLink: req.body.videoLink || '',
      productName: productName || undefined,
    };

    // Add house/land specific fields
    if (category === 'house') {
      if (bedrooms) postData.bedrooms = Number(bedrooms);
      if (bathrooms) postData.bathrooms = Number(bathrooms);
      if (size) postData.size = Number(size);
    }
    if (category === 'land' && size) postData.size = Number(size);

    // ---------- 9. Save post ----------
    const post = new Post(postData);
    await post.save();
    uploadedStorageKeys.length = 0;
    console.log('✅ Post saved successfully. ID:', post._id);
    try {
      await notifyUsers({
        type: 'NEW_POST',
        title: post.productName || 'New post',
        message: 'New post added',
        image: post.houseImages?.[0] || '',
        postId: post._id,
        actorId: userId,
      });
    } catch (notificationError) {
      console.error('New post notification error:', notificationError);
    }

    res.status(201).json({ success: true, post });
  } catch (error) {
    await Promise.all(uploadedStorageKeys.map(key => storageService.deleteMedia(key).catch(deleteError => {
      console.error('[Storage] Failed to clean up an unsaved post upload:', deleteError.code || 'B2_OPERATION_FAILED');
    })));
    console.error('CREATE POST ERROR:', error.code || error.message || 'Unknown error');
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Post could not be created',
    });
  }
};

// ---------- GET ALL POSTS (public) ----------
// @route   GET /api/posts
exports.getAllPosts = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const skip = (page - 1) * limit;
    const filter = req.query.trending === 'true' ? { trending: true } : {};

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ trending: -1, featured: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'username avatar'),
      Post.countDocuments(filter),
    ]);

    const hasMore = skip + posts.length < total;
    res.json({ success: true, posts, total, page, hasMore });
  } catch (error) {
    console.error('GET ALL POSTS ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
// ---------- GET MY POSTS (protected) ----------
// @route   GET /api/posts/me
exports.getMyPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const posts = await Post.find({ user: userId }).sort({ createdAt: -1 });
    res.json({ success: true, posts });
  } catch (error) {
    console.error('GET MY POSTS ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------- GET SAVED POSTS (protected) ----------
// @route   GET /api/posts/saved
exports.getSavedPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const saved = await SavedPost.find({ user: userId })
      .populate('post')
      .sort({ savedAt: -1 });
    const user = await User.findById(userId).populate('savedPosts');
    const uniquePosts = new Map();
    [...saved.map((entry) => entry.post), ...(user?.savedPosts || [])]
      .filter(Boolean)
      .forEach((post) => uniquePosts.set(post._id.toString(), post));
    const posts = [...uniquePosts.values()];
    res.json({ success: true, posts });
  } catch (error) {
    console.error('GET SAVED POSTS ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------- TOGGLE SAVE / UNSAVE ----------
// @route   POST /api/posts/save/:postId
exports.toggleSavePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const existing = await SavedPost.findOne({ user: userId, post: postId });

    if (existing) {
      await SavedPost.findOneAndDelete({ user: userId, post: postId });
      return res.json({ success: true, saved: false, message: 'Post unsaved' });
    } else {
      await SavedPost.create({ user: userId, post: postId });
      return res.json({ success: true, saved: true, message: 'Post saved' });
    }
  } catch (error) {
    console.error('TOGGLE SAVE ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------- GET USER POSTS (public) ----------
// @route   GET /api/posts/user/:userId
exports.getUserPosts = async (req, res) => {
  try {
    const userId = req.params.userId;
    const posts = await Post.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate('user', 'username avatar');
    res.json({ success: true, posts });
  } catch (error) {
    console.error('GET USER POSTS ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------- GET POST BY ID ----------
// @route   GET /api/posts/:postId
exports.getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId).populate('user', 'username avatar');
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, post });
  } catch (error) {
    console.error('GET POST BY ID ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------- DELETE POST ----------
// @route   DELETE /api/posts/:postId
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    if (post.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await deletePostWithCleanup(req.params.postId);

    res.json({ success: true, message: 'Post and all related data deleted successfully' });
  } catch (error) {
    console.error('DELETE POST ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

