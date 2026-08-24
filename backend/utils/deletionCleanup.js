const cloudinary = require('../config/cloudinary');
const mongoose = require('mongoose');
const Place = require('../models/Place');
const Post = require('../models/Post');
const Message = require('../models/Message');
const Favorite = require('../models/Favorite');
const SavedPost = require('../models/SavedPost');
const Report = require('../models/Report');
const User = require('../models/User');

const CLOUDINARY_HOSTNAME = 'res.cloudinary.com';

function isCloudinaryUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.toLowerCase().includes(CLOUDINARY_HOSTNAME);
}

function parseCloudinaryPublicId(url) {
  if (!isCloudinaryUrl(url)) return null;
  const normalized = String(url).trim();
  const lower = normalized.toLowerCase();
  const resourceType = lower.includes('/video/') || lower.includes('/video/upload') ? 'video' : 'image';
  const match = normalized.match(/\/\w+\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?(?:\?.*)?$/);
  if (!match || !match[1]) return null;
  return {
    cloudinaryPublicId: match[1],
    cloudinaryResourceType: resourceType,
  };
}

function collectCloudinaryIds(urls) {
  const ids = [];
  if (!Array.isArray(urls)) return ids;
  for (const url of urls) {
    if (!url || typeof url !== 'string') continue;
    if (!isCloudinaryUrl(url)) continue;
    const parsed = parseCloudinaryPublicId(url);
    if (parsed && parsed.cloudinaryPublicId) {
      ids.push({ publicId: parsed.cloudinaryPublicId, resourceType: parsed.cloudinaryResourceType });
    }
  }
  return ids;
}

function isCloudinaryConfigured() {
  return cloudinary.config().cloud_name && cloudinary.config().cloud_name !== 'dummy';
}

async function deleteCloudinaryAsset(publicId, resourceType = 'image') {
  if (!isCloudinaryConfigured()) {
    console.warn('[DeletionCleanup] Cloudinary not configured – skipping asset deletion:', publicId);
    return null;
  }
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType === 'video' ? 'video' : 'image',
    });
    if (result && result.result !== 'ok' && result.result !== 'not found') {
      console.warn('[DeletionCleanup] Cloudinary non-ok result:', result.result, 'for', publicId);
    }
    return result;
  } catch (error) {
    console.error('[DeletionCleanup] Cloudinary delete failed for', publicId, ':', error.message || error);
    return null;
  }
}

async function deleteCloudinaryAssets(assetList) {
  if (!assetList || assetList.length === 0) return;
  if (!isCloudinaryConfigured()) {
    console.warn('[DeletionCleanup] Cloudinary not configured – skipping', assetList.length, 'assets');
    return;
  }
  for (const { publicId, resourceType } of assetList) {
    await deleteCloudinaryAsset(publicId, resourceType);
  }
}

function getMediaIdsFromMessage(msg) {
  const ids = [];
  if (msg.cloudinaryPublicId) {
    ids.push({ publicId: msg.cloudinaryPublicId, resourceType: msg.cloudinaryResourceType || (msg.videoUrl && isCloudinaryUrl(msg.videoUrl) ? 'video' : 'image') });
  }
  if (msg.imageUrl && isCloudinaryUrl(msg.imageUrl)) {
    const parsed = parseCloudinaryPublicId(msg.imageUrl);
    if (parsed && parsed.cloudinaryPublicId) ids.push(parsed);
  }
  if (msg.videoUrl && isCloudinaryUrl(msg.videoUrl)) {
    const parsed = parseCloudinaryPublicId(msg.videoUrl);
    if (parsed && parsed.cloudinaryPublicId) ids.push(parsed);
  }
  if (msg.audioUrl && isCloudinaryUrl(msg.audioUrl)) {
    const parsed = parseCloudinaryPublicId(msg.audioUrl);
    if (parsed && parsed.cloudinaryPublicId) ids.push({ ...parsed, resourceType: 'video' });
  }
  return ids;
}

async function deleteMessagesForPost(postId) {
  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) return;
  const messages = await Message.find({ postId: String(postId) }).lean();
  if (!messages.length) return;

  const mediaIds = [];
  for (const msg of messages) {
    mediaIds.push(...getMediaIdsFromMessage(msg));
  }

  await Message.deleteMany({ postId: String(postId) });

  await deleteCloudinaryAssets(mediaIds);
}

async function deleteMessagesReplyPost(postId) {
  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) return;
  const messages = await Message.find({ 'replyPost.postId': postId }).lean();
  if (!messages.length) return;

  const mediaIds = [];
  for (const msg of messages) {
    mediaIds.push(...getMediaIdsFromMessage(msg));
  }

  await Message.updateMany(
    { 'replyPost.postId': postId },
    {
      $unset: {
        'replyPost.postId': '',
        'replyPost.title': '',
        'replyPost.description': '',
        'replyPost.image': '',
        'replyPost.price': '',
        'replyPost.location': '',
        'replyPost.ownerId': '',
        'replyPost.timestamp': '',
        'replyPost.available': '',
      },
    }
  );

  await deleteCloudinaryAssets(mediaIds);
}

async function deletePostWithCleanup(postId) {
  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
    throw new Error('Invalid post ID');
  }

  const post = await Post.findById(postId).lean();
  if (!post) return;

  const cloudinaryIds = collectCloudinaryIds(post.houseImages || []);
  if (post.videoUrl && isCloudinaryUrl(post.videoUrl)) {
    const parsed = parseCloudinaryPublicId(post.videoUrl);
    if (parsed) cloudinaryIds.push(parsed);
  }

  await deleteMessagesForPost(postId);
  await deleteMessagesReplyPost(postId);

  await SavedPost.deleteMany({ post: postId });
  await Report.deleteMany({ post: postId });

  await Post.findByIdAndDelete(postId);

  await deleteCloudinaryAssets(cloudinaryIds);
}

async function deletePlaceWithCleanup(placeId) {
  if (!placeId || !mongoose.Types.ObjectId.isValid(placeId)) {
    throw new Error('Invalid place ID');
  }

  const place = await Place.findById(placeId).lean();
  if (!place) return;

  const cloudinaryIds = [];

  if (place.images) {
    Object.values(place.images).forEach(url => {
      if (url && typeof url === 'string' && isCloudinaryUrl(url)) {
        const parsed = parseCloudinaryPublicId(url);
        if (parsed) cloudinaryIds.push(parsed);
      }
    });
  }

  if (place.products && Array.isArray(place.products)) {
    for (const product of place.products) {
      if (product.images && Array.isArray(product.images)) {
        cloudinaryIds.push(...collectCloudinaryIds(product.images));
      }
    }
  }

  const relatedPosts = await Post.find({ user: place.userId }).select('_id houseImages videoUrl').lean();
  const postIds = relatedPosts.map(p => p._id);

  for (const post of relatedPosts) {
    const postMediaIds = collectCloudinaryIds(post.houseImages || []);
    if (post.videoUrl && isCloudinaryUrl(post.videoUrl)) {
      const parsed = parseCloudinaryPublicId(post.videoUrl);
      if (parsed) postMediaIds.push(parsed);
    }
    cloudinaryIds.push(...postMediaIds);
  }

  for (const pid of postIds) {
    await deleteMessagesForPost(pid);
    await deleteMessagesReplyPost(pid);
  }

  await SavedPost.deleteMany({ post: { $in: postIds } });
  await Report.deleteMany({ post: { $in: postIds } });
  await Post.deleteMany({ _id: { $in: postIds } });

  await Favorite.deleteMany({ placeId: placeId });
  await Favorite.deleteMany({ shopId: placeId });

  await Place.findByIdAndDelete(placeId);

  await deleteCloudinaryAssets(cloudinaryIds);
}

async function deleteMallShopWithCleanup(shopId) {
  if (!shopId || !mongoose.Types.ObjectId.isValid(shopId)) {
    throw new Error('Invalid mall shop ID');
  }

  const shop = await MallShop.findById(shopId).lean();
  if (!shop) return;

  const cloudinaryIds = [];

  if (shop.images && shop.images.frontImage && isCloudinaryUrl(shop.images.frontImage)) {
    const parsed = parseCloudinaryPublicId(shop.images.frontImage);
    if (parsed) cloudinaryIds.push(parsed);
  }

  if (shop.products && Array.isArray(shop.products)) {
    for (const product of shop.products) {
      if (product.images && Array.isArray(product.images)) {
        cloudinaryIds.push(...collectCloudinaryIds(product.images));
      }
    }
  }

  const relatedPostIds = [];
  const shopMessages = await Message.find({
    $or: [
      { postId: String(shopId) },
      { 'replyPost.postId': shopId },
    ],
  }).select('postId').lean();

  for (const msg of shopMessages) {
    if (msg.postId && !relatedPostIds.includes(msg.postId)) {
      relatedPostIds.push(msg.postId);
    }
    if (msg.replyPost && msg.replyPost.postId && !relatedPostIds.includes(msg.replyPost.postId)) {
      relatedPostIds.push(msg.replyPost.postId);
    }
  }

  for (const pid of relatedPostIds) {
    await deleteMessagesForPost(pid);
  }

  await Message.deleteMany({
    $or: [
      { postId: String(shopId) },
      { 'replyPost.postId': shopId },
    ],
  });

  await Post.deleteMany({ _id: { $in: relatedPostIds.map(id => mongoose.Types.ObjectId(id)) } });
  await Favorite.deleteMany({ shopId: shopId });

  await MallShop.findByIdAndDelete(shopId);

  await deleteCloudinaryAssets(cloudinaryIds);
}

async function deleteShopWithCleanup(shopId) {
  if (!shopId || !mongoose.Types.ObjectId.isValid(shopId)) {
    throw new Error('Invalid shop ID');
  }

  const shop = await Place.findById(shopId).lean();
  if (!shop) return;

  const cloudinaryIds = [];

  if (shop.images) {
    Object.values(shop.images).forEach(url => {
      if (url && typeof url === 'string' && isCloudinaryUrl(url)) {
        const parsed = parseCloudinaryPublicId(url);
        if (parsed) cloudinaryIds.push(parsed);
      }
    });
  }

  if (shop.products && Array.isArray(shop.products)) {
    for (const product of shop.products) {
      if (product.images && Array.isArray(product.images)) {
        cloudinaryIds.push(...collectCloudinaryIds(product.images));
      }
    }
  }

  const relatedPosts = await Post.find({ user: shop.userId }).select('_id houseImages videoUrl').lean();
  const postIds = relatedPosts.map(p => p._id);

  for (const post of relatedPosts) {
    const postMediaIds = collectCloudinaryIds(post.houseImages || []);
    if (post.videoUrl && isCloudinaryUrl(post.videoUrl)) {
      const parsed = parseCloudinaryPublicId(post.videoUrl);
      if (parsed) postMediaIds.push(parsed);
    }
    cloudinaryIds.push(...postMediaIds);
  }

  for (const pid of postIds) {
    await deleteMessagesForPost(pid);
    await deleteMessagesReplyPost(pid);
  }

  await SavedPost.deleteMany({ post: { $in: postIds } });
  await Report.deleteMany({ post: { $in: postIds } });
  await Post.deleteMany({ _id: { $in: postIds } });

  await Favorite.deleteMany({ placeId: shopId });
  await Favorite.deleteMany({ shopId: shopId });

  await Place.findByIdAndDelete(shopId);

  await deleteCloudinaryAssets(cloudinaryIds);
}

module.exports = {
  isCloudinaryUrl,
  parseCloudinaryPublicId,
  collectCloudinaryIds,
  isCloudinaryConfigured,
  deleteCloudinaryAsset,
  deleteCloudinaryAssets,
  getMediaIdsFromMessage,
  deleteMessagesForPost,
  deleteMessagesReplyPost,
  deletePostWithCleanup,
  deletePlaceWithCleanup,
  deleteMallShopWithCleanup,
  deleteShopWithCleanup,
};
