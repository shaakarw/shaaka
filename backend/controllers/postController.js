// controllers/postController.js
const Post = require('../models/Post');
const User = require('../models/User');
const SavedPost = require('../models/SavedPost');
const storageService = require('../services/storage/storageService');
const { processVideoBuffer } = require('../services/videoProcessing');
const { uploadImageWithVariants } = require('../services/imageUpload');
const { deletePostWithCleanup } = require('../utils/deletionCleanup');
const { normalizeRwandaPhone, isValidRwandaPhone } = require('../utils/phoneNormalizer');
const { notifyUsers } = require('../services/notificationService');
const { getClient } = require('../config/db');
const { DEFAULT_USER_PERMISSIONS } = require('../config/userPermissions');
const {
  normalizeSearchText,
  expandSearchTerms,
  scoreProduct,
  suggestCorrection,
  getSuggestions,
} = require('../utils/smartSearch');

// ----- Import subscription helpers -----
const {
  computeAggregatedLimits,
  MAX_IMAGES_PER_POST,
} = require('../utils/subscriptionHelpers_clean');
const {
  getDailyUsage,
  getNextDailyReset,
  reserveDailyUsage,
  releaseDailyUsage,
} = require('../utils/permissionUsage');

const encodePostCursor = post => {
  const createdAt = new Date(post.createdAt);
  if (!Number.isFinite(createdAt.getTime())) {
    throw new TypeError('Cannot encode a post cursor without a valid createdAt timestamp.');
  }
  return Buffer.from(JSON.stringify({
    createdAt: createdAt.toISOString(),
    id: String(post._id),
  })).toString('base64url');
};

const decodePostCursor = value => {
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const createdAt = new Date(decoded.createdAt);
    if (!Number.isFinite(createdAt.getTime()) || !/^[a-f\d]{24}$/i.test(decoded.id)) return null;
    return { createdAt, id: decoded.id };
  } catch {
    return null;
  }
};

// ---------- CREATE POST ----------
// @route   POST /api/posts
// @desc    Create a new post (enforces total, cooldown, daily, and lifetime limits)
exports.createPost = async (req, res) => {
  const uploadedStorageKeys = [];
  const usageReservations = [];
  const quotaRequestTime = new Date();
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('phone username avatar avatarVariants paymentHistory postUploadLimitPerDay allowVideoUpload videoUploadLimitPerDay');
    if (!user) {
      console.error('User not found:', userId);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // ----- 1. Compute user's aggregated limits -----
    const limits = computeAggregatedLimits(user);
    console.log('User limits:', limits);

    // ----- 2. Get today's usage (posts & images) from DB -----
    const postsToday = await getDailyUsage(userId, 'posts', quotaRequestTime);

    // ----- 3. Check daily post limit (admin override respected via computeAggregatedLimits) -----
    const remainingPosts = limits.postsPerDay - postsToday;
    if (remainingPosts <= 0) {
      return res.status(403).json({
        success: false,
        message: 'Daily post limit reached.',
        resetsAt: getNextDailyReset(quotaRequestTime).toISOString(),
      });
    }

    const imageFiles = (req.files && req.files.images) || [];
    const videoFile = req.files?.video?.[0];

    if (videoFile) {
      if (user.allowVideoUpload === false) {
        return res.status(403).json({
          success: false,
          message: 'Video uploads are not enabled for this account.',
        });
      }

      const videoLimit = Number.isSafeInteger(user.videoUploadLimitPerDay)
        ? Math.max(0, user.videoUploadLimitPerDay)
        : DEFAULT_USER_PERMISSIONS.videoUploadLimitPerDay;
      const videosToday = await getDailyUsage(userId, 'videos', quotaRequestTime);

      if (videoLimit <= 0 || videosToday >= videoLimit) {
        return res.status(403).json({
          success: false,
          message: 'Daily video upload limit reached.',
          resetsAt: getNextDailyReset(quotaRequestTime).toISOString(),
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
    const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
    if (imageFiles.some(file => !file.buffer || file.buffer.length > MAX_IMAGE_BYTES)) {
      return res.status(400).json({ success: false, message: 'One or more images exceed the 3 MB size limit.' });
    }
    if (videoFile && (!videoFile.buffer || videoFile.buffer.length > MAX_VIDEO_BYTES)) {
      return res.status(400).json({ success: false, message: 'Video exceeds the 80 MB size limit.' });
    }

    if (imageFiles.length > MAX_IMAGES_PER_POST) {
      return res.status(400).json({
        success: false,
        message: `You can only upload up to ${MAX_IMAGES_PER_POST} images per post.`,
      });
    }

    const postReserved = await reserveDailyUsage(
      userId,
      'posts',
      1,
      limits.postsPerDay,
      quotaRequestTime
    );
    if (!postReserved) {
      return res.status(403).json({
        success: false,
        message: 'Daily post limit reached.',
        resetsAt: getNextDailyReset(quotaRequestTime).toISOString(),
      });
    }
    usageReservations.push({ key: 'posts', amount: 1 });

    if (videoFile) {
      const videoReserved = await reserveDailyUsage(
        userId,
        'videos',
        1,
        user.videoUploadLimitPerDay,
        quotaRequestTime
      );
      if (!videoReserved) {
        await releaseDailyUsage(userId, 'posts', 1, quotaRequestTime);
        usageReservations.pop();
        return res.status(403).json({
          success: false,
          message: 'Daily video upload limit reached.',
          resetsAt: getNextDailyReset(quotaRequestTime).toISOString(),
        });
      }
      usageReservations.push({ key: 'videos', amount: 1 });
    }

    if (videoFile) {
      console.info('[Post] Video upload started.', {
        fileSize: videoFile.size || videoFile.buffer.length,
        mimeType: videoFile.mimetype,
      });
    }
    const videoProcessingResult = videoFile
      ? await processVideoBuffer(videoFile.buffer)
      : null;
    if (videoFile && (
      !videoProcessingResult ||
      !Number.isFinite(videoProcessingResult.duration) ||
      videoProcessingResult.duration <= 0
    )) {
      const error = new Error('Video duration could not be determined. Please select a valid video.');
      error.statusCode = 422;
      throw error;
    }
    if (videoProcessingResult?.wasTrimmed) {
      console.info('[Post] Video was automatically trimmed to 2 minutes.');
    }

    // ---------- 7. Handle image uploads ----------
    const imageUrls = [];
    const houseImageStorageKeys = [];
    const houseImageVariants = [];
    const postId = new Post()._id;
    if (imageFiles.length > 0) {
      for (const file of imageFiles) {
        const uploaded = await uploadImageWithVariants({
          buffer: file.buffer,
          mimeType: file.mimetype,
          folder: `posts/${postId}/images`,
          maxBytes: MAX_IMAGE_BYTES,
          origin: storageService.getRequestOrigin(req),
        });
        uploadedStorageKeys.push(...uploaded.storageKeys);
        houseImageStorageKeys.push(uploaded.original.storageKey);
        imageUrls.push(uploaded.originalUrl);
        houseImageVariants.push(uploaded.imageVariants);
      }
    }

    // ---------- 8. Build post data ----------
    let videoUrl = '';
    let videoHlsUrl = '';
    let videoThumbnail = '';
    let videoThumbnailStorageKey = '';
    let videoId = '';
    let videoStorageKey = '';
    const uploadedVideoDuration = videoProcessingResult?.duration ?? 0;
    if (videoFile) {
      const videoResult = await storageService.uploadMedia({
        buffer: videoProcessingResult.videoBuffer,
        mimeType: videoProcessingResult.mimeType || videoFile.mimetype,
        folder: `posts/${postId}/videos`,
        maxBytes: MAX_VIDEO_BYTES,
      });
      uploadedStorageKeys.push(videoResult.storageKey);
      console.info('[Post] Video upload completed.', {
        postId: String(postId),
        fileSize: videoResult.fileSize,
      });
      videoStorageKey = videoResult.storageKey;
      videoId = videoStorageKey;
      videoUrl = storageService.getMediaUrl(videoStorageKey, {
        origin: storageService.getRequestOrigin(req),
      });
      const thumbnailResult = await storageService.uploadMedia({
        buffer: videoProcessingResult.thumbnailBuffer,
        mimeType: 'image/jpeg',
        folder: `posts/${postId}/thumbnails`,
        maxBytes: MAX_IMAGE_BYTES,
      });
      uploadedStorageKeys.push(thumbnailResult.storageKey);
      videoThumbnailStorageKey = thumbnailResult.storageKey;
      videoThumbnail = storageService.getMediaUrl(videoThumbnailStorageKey, {
        origin: storageService.getRequestOrigin(req),
      });
    }

    const postData = {
      _id: postId,
      user: userId,
      username: user.username,
      userPhone: contactNumber1,
      userAvatar: user.avatar || '',
      userAvatarVariants: user.avatarVariants || [],
      category,
      description,
      location,
      price: Number(price),
      priceNegotiable: priceNegotiable === 'true' || priceNegotiable === true,
      contactNumbers,
      houseImages: imageUrls,
      houseImageStorageKeys,
      houseImageVariants,
      storageProvider: 'b2',
      videoUrl,
      videoHlsUrl,
      videoId,
      videoStorageKey,
      videoDuration: uploadedVideoDuration,
      videoThumbnail,
      videoThumbnailStorageKey,
      videoThumbnailStatus: videoFile ? 'completed' : '',
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
    try {
      await post.save();
    } catch (error) {
      console.error('[Post] Database insertion failed:', error.message);
      throw error;
    }
    usageReservations.length = 0;
    uploadedStorageKeys.length = 0;
    console.info('[Post] Database insertion completed.', {
      postId: String(post._id),
      videoDurationSeconds: post.videoDuration,
    });
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
    await Promise.all(usageReservations.map(({ key, amount }) => (
      releaseDailyUsage(req.user.id, key, amount, quotaRequestTime).catch(releaseError => {
        console.error('[Permissions] Could not release failed post quota:', releaseError.code || releaseError.message);
      })
    )));
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
    if (req.query.pagination === 'cursor') {
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
      const filter = {
        status: { $ne: 'stopped' },
        createdAt: { $type: 'date' },
      };

      if (req.query.trending === 'true') filter.trending = true;

      if (req.query.cursor) {
        const cursor = decodePostCursor(String(req.query.cursor));
        if (!cursor) {
          return res.status(400).json({ success: false, message: 'Invalid feed cursor.' });
        }
        filter.$or = [
          { createdAt: { $lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
        ];
      }

      const batchSize = Math.min(Math.max(limit * 2, 40), 100);
      const posts = [];
      let batchFilter = filter;
      while (posts.length <= limit) {
        const candidates = await Post.find(batchFilter)
          .sort({ createdAt: -1, _id: -1 })
          .limit(batchSize)
          .select('-videoStorageKey -videoThumbnailStorageKey -houseImageStorageKeys')
          .populate('user', 'username avatar avatarVariants blocked accountDeletionStatus')
          .lean();
        if (!candidates.length) break;

        for (const post of candidates) {
          const creator = post.user;
          if (
            !creator ||
            creator.blocked === true ||
            creator.accountDeletionStatus === 'deleted'
          ) {
            continue;
          }
          post.user = {
            _id: creator._id,
            username: creator.username,
            avatar: creator.avatar,
            avatarVariants: creator.avatarVariants || [],
          };
          posts.push(post);
          if (posts.length > limit) break;
        }

        if (posts.length > limit || candidates.length < batchSize) break;
        const lastCandidate = candidates[candidates.length - 1];
        batchFilter = {
          ...filter,
          $or: [
            { createdAt: { $lt: lastCandidate.createdAt } },
            {
              createdAt: lastCandidate.createdAt,
              _id: { $lt: lastCandidate._id },
            },
          ],
        };
      }

      const hasMore = posts.length > limit;
      if (hasMore) posts.pop();
      return res.json({
        success: true,
        posts,
        hasMore,
        nextCursor: hasMore && posts.length ? encodePostCursor(posts[posts.length - 1]) : null,
      });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const skip = (page - 1) * limit;
    const filter = req.query.trending === 'true' ? { trending: true } : {};

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ trending: -1, featured: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'username avatar avatarVariants')
        .lean(),
      Post.countDocuments(filter),
    ]);

    const hasMore = skip + posts.length < total;
    res.json({ success: true, posts, total, page, hasMore });
  } catch (error) {
    console.error('GET ALL POSTS ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const SEARCH_MATCH_LIMIT = 250;
const SEARCH_RECENT_LIMIT = 450;
const SEARCH_PAGE_SIZE = 20;

const searchPostSql = `
  SELECT p.payload, u.payload AS user_payload
  FROM posts p
  JOIN users u ON u.id = p.user_id
  WHERE (p.status IS NULL OR lower(p.status) != 'stopped')
    AND COALESCE(json_extract(u.payload, '$.blocked'), 0) != 1
    AND COALESCE(json_extract(u.payload, '$.accountDeletionStatus'), 'active') != 'deleted'
`;

const decodeSearchRows = (rows) => rows.map((row) => {
  const post = JSON.parse(row.payload);
  const user = JSON.parse(row.user_payload);
  post.user = {
    _id: user._id || user.id,
    username: user.username || '',
    avatar: user.avatar || '',
    avatarVariants: user.avatarVariants || [],
  };
  return post;
});

const searchCandidates = async (query) => {
  const database = getClient();
  const compact = query.replace(/\s+/g, '');
  const terms = expandSearchTerms(query).slice(0, 10);
  const expressions = [
    "lower(json_extract(p.payload, '$.productName'))",
    "lower(json_extract(p.payload, '$.brand'))",
    "lower(json_extract(p.payload, '$.model'))",
    "lower(json_extract(p.payload, '$.modelName'))",
    'lower(p.category)',
    "lower(json_extract(p.payload, '$.subcategory'))",
    "lower(json_extract(p.payload, '$.description'))",
    "lower(json_extract(p.payload, '$.tags'))",
    "lower(json_extract(p.payload, '$.searchKeywords'))",
    "lower(json_extract(p.payload, '$.keywords'))",
    "lower(json_extract(p.payload, '$.attributes'))",
    "lower(json_extract(p.payload, '$.storeName'))",
    "lower(json_extract(p.payload, '$.location'))",
    'lower(u.username)',
  ];
  const conditions = [];
  const args = [];
  for (const term of terms) {
    for (const expression of expressions) {
      conditions.push(`${expression} GLOB ?`);
      args.push(`${term}*`);
    }
  }

  const matchingRows = conditions.length
    ? await database.execute({
      sql: `${searchPostSql} AND (${conditions.join(' OR ')}) ORDER BY p.created_at DESC LIMIT ?`,
      args: [...args, SEARCH_MATCH_LIMIT],
    })
    : { rows: [] };
  const typoPrefixes = [...new Set([compact.slice(0, 1), compact.slice(0, 2)])]
    .filter((term) => term.length >= 1);
  const typoExpressions = [
    "lower(json_extract(p.payload, '$.productName'))",
    "lower(json_extract(p.payload, '$.brand'))",
    "lower(json_extract(p.payload, '$.model'))",
    "lower(json_extract(p.payload, '$.modelName'))",
  ];
  const typoConditions = [];
  const typoArgs = [];
  for (const prefix of typoPrefixes) {
    for (const expression of typoExpressions) {
      typoConditions.push(`${expression} GLOB ?`);
      typoArgs.push(`${prefix}*`);
    }
  }
  const typoRows = await database.execute({
    sql: `${searchPostSql} AND (${typoConditions.join(' OR ')}) ORDER BY p.created_at DESC LIMIT ?`,
    args: [...typoArgs, 150],
  });
  const recentRows = await database.execute({
    sql: `${searchPostSql} ORDER BY p.created_at DESC LIMIT ?`,
    args: [SEARCH_RECENT_LIMIT],
  });
  const unique = new Map();
  for (const post of [
    ...decodeSearchRows(matchingRows.rows),
    ...decodeSearchRows(typoRows.rows),
    ...decodeSearchRows(recentRows.rows),
  ]) {
    unique.set(String(post._id || post.id), post);
  }
  return [...unique.values()];
};

const orderSearchResults = (query, posts) => posts
  .map((post) => ({ post, relevance: scoreProduct(query, post) }))
  .filter((entry) => entry.relevance > 0)
  .sort((left, right) => (
    right.relevance - left.relevance
    || Number(Boolean(right.post.featured)) - Number(Boolean(left.post.featured))
    || Number(Boolean(right.post.trending)) - Number(Boolean(left.post.trending))
    || new Date(right.post.createdAt || 0) - new Date(left.post.createdAt || 0)
  ));

exports.searchPosts = async (req, res) => {
  try {
    const rawQuery = String(req.query.q || '').slice(0, 80);
    const query = normalizeSearchText(rawQuery);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || SEARCH_PAGE_SIZE, 1), 40);
    if (!query) {
      return res.json({ success: true, posts: [], suggestions: [], hasMore: false, page: 1 });
    }

    const candidates = await searchCandidates(query);
    const ranked = orderSearchResults(query, candidates);
    const offset = (page - 1) * limit;
    const posts = ranked.slice(offset, offset + limit).map(({ post }) => post);
    return res.json({
      success: true,
      posts,
      suggestions: getSuggestions(query, ranked.slice(0, 80).map(({ post }) => post)),
      correctedQuery: ranked.length ? suggestCorrection(query, ranked.slice(0, 40).map(({ post }) => post)) : null,
      hasMore: offset + posts.length < ranked.length,
      page,
    });
  } catch (error) {
    console.error('POST SEARCH ERROR:', error.code || error.message || 'Unknown error');
    return res.status(500).json({ success: false, message: 'Search is temporarily unavailable.' });
  }
};

exports.getPopularSearches = async (_req, res) => {
  try {
    const result = await getClient().execute({
      sql: `SELECT query FROM search_analytics WHERE search_count > 0
        ORDER BY search_count DESC, updated_at DESC LIMIT 8`,
    });
    return res.json({ success: true, searches: result.rows.map((row) => row.query) });
  } catch (error) {
    console.error('POPULAR SEARCHES ERROR:', error.code || error.message || 'Unknown error');
    return res.status(500).json({ success: false, message: 'Popular searches are temporarily unavailable.' });
  }
};

exports.trackSearchEvent = async (req, res) => {
  try {
    const query = normalizeSearchText(String(req.body.query || '').slice(0, 80));
    const event = String(req.body.event || 'search');
    if (!query || !['search', 'no_results', 'suggestion', 'typo', 'product_view'].includes(event)) {
      return res.status(400).json({ success: false, message: 'A valid search query and event are required.' });
    }
    if (event === 'product_view') {
      const postId = String(req.body.postId || '');
      if (!/^[a-f\d]{24}$/i.test(postId)) {
        return res.status(400).json({ success: false, message: 'A valid product id is required.' });
      }
      await getClient().execute({
        sql: `INSERT INTO search_product_analytics (post_id, view_count)
          VALUES (?, 1)
          ON CONFLICT(post_id) DO UPDATE SET
            view_count = view_count + 1,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
        args: [postId],
      });
      return res.json({ success: true });
    }
    const key = query.slice(0, 80);
    const column = event === 'no_results' ? 'no_result_count'
      : event === 'suggestion' ? 'suggestion_count'
        : event === 'typo' ? 'typo_count' : 'search_count';
    await getClient().execute({
      sql: `INSERT INTO search_analytics (query_key, query, ${column})
        VALUES (?, ?, 1)
        ON CONFLICT(query_key) DO UPDATE SET
          ${column} = ${column} + 1,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      args: [key, query],
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('SEARCH ANALYTICS ERROR:', error.code || error.message || 'Unknown error');
    return res.status(500).json({ success: false, message: 'Search analytics could not be recorded.' });
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
      .populate('user', 'username avatar avatarVariants')
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
    const post = await Post.findById(req.params.postId).populate('user', 'username avatar avatarVariants');
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
