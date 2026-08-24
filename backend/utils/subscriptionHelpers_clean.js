// utils/subscriptionHelpers_clean.js
// Cleaned and simplified helpers for usage limits

const MAX_IMAGES_PER_POST = 2;

const DEFAULTS = {
  imagesPerMessage: 10,
  postsPerDay: 1,
  totalPostImagesPerDay: 2,
  imagesRetentionDays: 5,
  messagesRetentionDays: 30,
};

const computeAggregatedLimits = (user) => {
  const postsPerDay = (user && typeof user.postUploadLimitPerDay === 'number') ? user.postUploadLimitPerDay : DEFAULTS.postsPerDay;
  const imagesPerMessage = DEFAULTS.imagesPerMessage;

  return {
    imagesPerMessage,
    postsPerDay,
    totalPostImagesPerDay: DEFAULTS.totalPostImagesPerDay,
    imagesRetentionDays: DEFAULTS.imagesRetentionDays,
    messagesRetentionDays: DEFAULTS.messagesRetentionDays,
  };
};

const getTodayUsageFromDB = async (Model, userId) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  let queryField = 'user';
  if (Model.modelName === 'Message') queryField = 'senderId';

  const query = { [queryField]: userId, createdAt: { $gte: startOfDay, $lte: endOfDay } };
  const docs = await Model.find(query);

  let postsUsed = docs.length;
  let imagesUsed = 0;

  if (Model.modelName === 'Post') {
    imagesUsed = docs.reduce((acc, doc) => acc + (doc.houseImages ? doc.houseImages.length : 0), 0);
  } else if (Model.modelName === 'Message') {
    imagesUsed = docs.filter(doc => doc.imageUrl && doc.imageUrl.length > 0).length;
  } else {
    imagesUsed = docs.reduce((acc, doc) => acc + (doc.images ? doc.images.length : 0), 0);
  }

  return { postsUsed, imagesUsed };
};


const getRemainingUsageToday = async (user, Model, todayUsage = null) => {
  const limits = computeAggregatedLimits(user);
  let usage = todayUsage;
  if (!usage) usage = await getTodayUsageFromDB(Model, user._id);

  const remainingPosts = Math.max(limits.postsPerDay - usage.postsUsed, 0);
  const remainingPostImages = Math.min(limits.totalPostImagesPerDay - usage.imagesUsed, remainingPosts * MAX_IMAGES_PER_POST);
  const remainingMessageImages = Math.max(limits.imagesPerMessage - usage.imagesUsed, 0);

  return { ...usage, remainingPosts, remainingPostImages: Math.max(remainingPostImages, 0), remainingMessageImages, remainingImages: Math.max(remainingMessageImages, 0) };
};

const canCreatePostToday = async (user, PostModel, todayUsage = null) => {
  const { remainingPosts } = await getRemainingUsageToday(user, PostModel, todayUsage);
  return remainingPosts > 0;
};

const canSendImageToday = async (user, MessageModel, todayUsage = null) => {
  const { remainingMessageImages } = await getRemainingUsageToday(user, MessageModel, todayUsage);
  return remainingMessageImages > 0;
};

// Minimal stubs for older APIs that reference subscriptions
const getActiveSubscriptions = (user) => {
  // payments/subscriptions are removed; return empty list
  return [];
};

const getSubscription = (user) => {
  const limits = computeAggregatedLimits(user);
  return {
    subscriptionPlan: 'free',
    subscriptionPlanLabel: 'Free',
    paymentAmount: 0,
    uploadsRemaining: null,
    subscriptionStatus: 'free',
    expiresAt: null,
  };
};

module.exports = {
  MAX_IMAGES_PER_POST,
  computeAggregatedLimits,
  getTodayUsageFromDB,
  getRemainingUsageToday,
  canCreatePostToday,
  canSendImageToday,
  getActiveSubscriptions,
  getSubscription,
};