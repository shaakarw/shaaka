// controllers/postController.js
const Post = require('../models/Post');
const User = require('../models/User');
const SavedPost = require('../models/SavedPost');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');
const { deletePostWithCleanup } = require('../utils/deletionCleanup');
const { normalizeRwandaPhone, isValidRwandaPhone } = require('../utils/phoneNormalizer');
const { notifyUsers } = require('../services/notificationService');

// ----- Import subscription helpers -----
const {
  computeAggregatedLimits,
  getTodayUsageFromDB,
  MAX_IMAGES_PER_POST,
} = require('../utils/subscriptionHelpers_clean');

// ---------- Helper: upload buffer to Cloudinary (safe) ----------
const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    if (!cloudinary.config().cloud_name || cloudinary.config().cloud_name === 'dummy') {
      return reject(new Error('Cloudinary not configured – skipping upload'));
    }
    const stream = cloudinary.uploader.upload_stream(
      { folder, transformation: [{ width: 800, crop: 'limit' }] },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

// ---------- CREATE POST ----------
// @route   POST /api/posts
// @desc    Create a new post (enforces total, cooldown, daily, and lifetime limits)
exports.createPost = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('phone username avatar paymentHistory postUploadLimitPerDay');
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

    const imageFiles = (req.files && req.files.images) || [];

    if (imageFiles.length === 0) {
      return res.status(400).json({ success: false, message: 'Please attach at least one image to create a post.' });
    }

    // ---------- 7. Handle image uploads ----------
    const imageUrls = [];
    if (imageFiles.length > 0) {
      // 7a. Check per‑post image limit (constant 2)
      if (imageFiles.length > MAX_IMAGES_PER_POST) {
        return res.status(400).json({
          success: false,
          message: `You can only upload up to ${MAX_IMAGES_PER_POST} images per post.`,
        });
      }

      // 7d. Upload each image to Cloudinary
      for (const file of imageFiles) {
        try {
          // Enforce image size limit (3 MB)
          const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
          if (!file.buffer || file.buffer.length > MAX_IMAGE_BYTES) {
            return res.status(400).json({ success: false, message: 'One or more images exceed the 3 MB size limit.' });
          }
          const url = await uploadToCloudinary(file.buffer, 'house_posts');
          imageUrls.push(url);
        } catch (uploadErr) {
          console.warn('Cloudinary upload skipped:', uploadErr.message);
          // Continue with other images
        }
      }
    }

    // ---------- 8. Build post data ----------
    const postData = {
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
    console.error('❌ CREATE POST ERROR:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET ALL POSTS (public) ----------
// @route   GET /api/posts
exports.getAllPosts = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'username avatar'),
      Post.countDocuments({}),
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
    const posts = saved.map(s => s.post).filter(p => p !== null);
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