const mongoose = require('mongoose');
const Place = require('../models/Place');
const Post = require('../models/Post');
const Message = require('../models/Message');
const Favorite = require('../models/Favorite');
const SavedPost = require('../models/SavedPost');
const Report = require('../models/Report');
const MallShop = require('../models/MallShop');
const storageService = require('../services/storage/storageService');

function collectStorageKeys(urls) {
  const keys = [];
  if (!Array.isArray(urls)) return keys;
  for (const url of urls) {
    const key = storageService.getStorageKeyFromUrl(url);
    if (key) keys.push(key);
  }
  return keys;
}

function getPostStorageKeys(post) {
  return [
    ...(post.houseImageStorageKeys || []),
    ...collectStorageKeys(post.houseImages || []),
    post.videoStorageKey,
    post.videoThumbnailStorageKey,
    storageService.getStorageKeyFromUrl(post.videoUrl),
    storageService.getStorageKeyFromUrl(post.videoThumbnail),
  ].filter(storageService.isStorageKey);
}

function getMessageStorageKeys(message) {
  return [
    message.imageStorageKey,
    message.videoStorageKey,
    message.audioStorageKey,
    storageService.getStorageKeyFromUrl(message.imageUrl),
    storageService.getStorageKeyFromUrl(message.videoUrl),
    storageService.getStorageKeyFromUrl(message.audioUrl),
  ].filter(storageService.isStorageKey);
}

function getPlaceStorageKeys(place) {
  const imageUrls = place.images ? Object.values(place.images) : [];
  const productImageUrls = (place.products || []).flatMap(product => product.images || []);
  const productKeys = (place.products || []).flatMap(product => product.imageStorageKeys || []);
  return [
    ...(Object.values(place.imageStorageKeys || {})),
    ...productKeys,
    ...collectStorageKeys([...imageUrls, ...productImageUrls]),
  ].filter(storageService.isStorageKey);
}

async function deleteStorageKeys(keys) {
  const uniqueKeys = [...new Set((keys || []).filter(storageService.isStorageKey))];
  await Promise.all(uniqueKeys.map(key => storageService.deleteMedia(key).catch(error => {
    console.error('[DeletionCleanup] B2 object deletion failed:', error.code || 'B2_OPERATION_FAILED');
  })));
}

async function deleteMessagesForPost(postId) {
  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) return;
  const messages = await Message.find({ postId: String(postId) }).lean();
  if (!messages.length) return;
  const keys = messages.flatMap(getMessageStorageKeys);
  await Message.deleteMany({ postId: String(postId) });
  await deleteStorageKeys(keys);
}

async function deleteMessagesReplyPost(postId) {
  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) return;
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
}

async function deletePostWithCleanup(postId) {
  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) throw new Error('Invalid post ID');
  const post = await Post.findById(postId).lean();
  if (!post) return;
  const keys = getPostStorageKeys(post);

  await deleteMessagesForPost(postId);
  await deleteMessagesReplyPost(postId);
  await SavedPost.deleteMany({ post: postId });
  await Report.deleteMany({ post: postId });
  await Post.findByIdAndDelete(postId);
  await deleteStorageKeys(keys);
}

async function deletePlaceWithCleanup(placeId) {
  if (!placeId || !mongoose.Types.ObjectId.isValid(placeId)) throw new Error('Invalid place ID');
  const place = await Place.findById(placeId).lean();
  if (!place) return;

  const keys = getPlaceStorageKeys(place);
  const relatedPosts = await Post.find({ user: place.userId }).select('_id houseImages houseImageStorageKeys videoUrl videoStorageKey videoThumbnail videoThumbnailStorageKey').lean();
  const postIds = relatedPosts.map(post => post._id);
  for (const post of relatedPosts) keys.push(...getPostStorageKeys(post));

  for (const postId of postIds) {
    await deleteMessagesForPost(postId);
    await deleteMessagesReplyPost(postId);
  }
  await SavedPost.deleteMany({ post: { $in: postIds } });
  await Report.deleteMany({ post: { $in: postIds } });
  await Post.deleteMany({ _id: { $in: postIds } });
  await Favorite.deleteMany({ placeId });
  await Favorite.deleteMany({ shopId: placeId });
  await Place.findByIdAndDelete(placeId);
  await deleteStorageKeys(keys);
}

async function deleteMallShopWithCleanup(shopId) {
  if (!shopId || !mongoose.Types.ObjectId.isValid(shopId)) throw new Error('Invalid mall shop ID');
  const shop = await MallShop.findById(shopId).lean();
  if (!shop) return;

  const keys = collectStorageKeys([
    shop.images?.frontImage,
    ...(shop.products || []).flatMap(product => product.images || []),
  ]).concat(
    shop.frontImageStorageKey || '',
    ...(shop.products || []).flatMap(product => product.imageStorageKeys || [])
  );
  const shopMessages = await Message.find({
    $or: [{ postId: String(shopId) }, { 'replyPost.postId': shopId }],
  }).select('postId replyPost imageUrl videoUrl audioUrl imageStorageKey videoStorageKey audioStorageKey').lean();
  keys.push(...shopMessages.flatMap(getMessageStorageKeys));

  const relatedPostIds = [...new Set(shopMessages.flatMap(message => [
    message.postId,
    message.replyPost?.postId ? String(message.replyPost.postId) : '',
  ]).filter(id => id && mongoose.Types.ObjectId.isValid(id)))];
  const relatedPosts = await Post.find({ _id: { $in: relatedPostIds } })
    .select('_id houseImages houseImageStorageKeys videoUrl videoStorageKey videoThumbnail videoThumbnailStorageKey').lean();
  for (const post of relatedPosts) keys.push(...getPostStorageKeys(post));

  for (const postId of relatedPostIds) await deleteMessagesForPost(postId);
  await Message.deleteMany({ $or: [{ postId: String(shopId) }, { 'replyPost.postId': shopId }] });
  await Post.deleteMany({ _id: { $in: relatedPostIds } });
  await Favorite.deleteMany({ shopId });
  await MallShop.findByIdAndDelete(shopId);
  await deleteStorageKeys(keys);
}

async function deleteShopWithCleanup(shopId) {
  if (!shopId || !mongoose.Types.ObjectId.isValid(shopId)) throw new Error('Invalid shop ID');
  const shop = await Place.findById(shopId).lean();
  if (!shop) return;

  const keys = getPlaceStorageKeys(shop);
  const relatedPosts = await Post.find({ user: shop.userId }).select('_id houseImages houseImageStorageKeys videoUrl videoStorageKey videoThumbnail videoThumbnailStorageKey').lean();
  const postIds = relatedPosts.map(post => post._id);
  for (const post of relatedPosts) keys.push(...getPostStorageKeys(post));

  for (const postId of postIds) {
    await deleteMessagesForPost(postId);
    await deleteMessagesReplyPost(postId);
  }
  await SavedPost.deleteMany({ post: { $in: postIds } });
  await Report.deleteMany({ post: { $in: postIds } });
  await Post.deleteMany({ _id: { $in: postIds } });
  await Favorite.deleteMany({ placeId: shopId });
  await Favorite.deleteMany({ shopId });
  await Place.findByIdAndDelete(shopId);
  await deleteStorageKeys(keys);
}

module.exports = {
  collectStorageKeys,
  deleteMessagesForPost,
  deleteMessagesReplyPost,
  deletePostWithCleanup,
  deletePlaceWithCleanup,
  deleteMallShopWithCleanup,
  deleteShopWithCleanup,
  deleteStorageKeys,
  getMessageStorageKeys,
  getPostStorageKeys,
};