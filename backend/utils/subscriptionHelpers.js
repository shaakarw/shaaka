// utils/subscriptionHelpers.js (BACKEND)

/**
 * Simplified subscription helpers — payments and subscription plans removed.
 * Default limits are enforced here and admin overrides on the User model are respected.
 *
 * Rules implemented:
 * - Posts per day: default 1 (user.postUploadLimitPerDay overrides)
 * - Post videos per day: default 1 (admin can override user.postVideoLimitPerDay)
 * - Message images per user (active in storage / last 5 days): max 10
 * - Images per message: up to 10
 * - Image retention: 5 days
 * - Message retention: 30 days
 * - Message videos per user per day: 5
 * - All videos max duration: 30 seconds
 */

const MAX_IMAGES_PER_POST = 2;

const DEFAULTS = {
  imagesPerMessage: 10,
  postsPerDay: 1,
  totalPostImagesPerDay: 2,
  imagesRetentionDays: 5,
  messagesRetentionDays: 30,
  postVideoDailyLimit: 1,
  messageVideoDailyLimit: 5,
  maxVideoDurationSeconds: 30,
};

const computeAggregatedLimits = (user) => {
  // Respect admin overrides on the user document when present
  const postsPerDay = (user && typeof user.postUploadLimitPerDay === 'number') ? user.postUploadLimitPerDay : DEFAULTS.postsPerDay;
  const postVideoDailyLimit = (user && typeof user.videoUploadLimitPerDay === 'number')
    ? user.videoUploadLimitPerDay
    : ((user && typeof user.postVideoLimitPerDay === 'number') ? user.postVideoLimitPerDay : DEFAULTS.postVideoDailyLimit);
  const imagesPerMessage = DEFAULTS.imagesPerMessage;
  const messageVideoDailyLimit = DEFAULTS.messageVideoDailyLimit;

  return {
    imagesPerMessage,
    postsPerDay,
    totalPostImagesPerDay: DEFAULTS.totalPostImagesPerDay,
    imagesRetentionDays: DEFAULTS.imagesRetentionDays,
    messagesRetentionDays: DEFAULTS.messagesRetentionDays,
    postVideoDailyLimit,
    messageVideoDailyLimit,
    maxVideoDurationSeconds: DEFAULTS.maxVideoDurationSeconds,
    allowVideoUpload: user ? user.allowVideoUpload !== false : true,
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

  let postsUsed = 0;
  let imagesUsed = 0;

  if (Model.modelName === 'Post') {
    postsUsed = docs.length;
    imagesUsed = docs.reduce((acc, doc) => acc + (doc.houseImages ? doc.houseImages.length : 0), 0);
  } else if (Model.modelName === 'Message') {
    postsUsed = docs.length;
    imagesUsed = docs.filter(doc => doc.imageUrl && doc.imageUrl.length > 0).length;
  } else {
    postsUsed = docs.length;
    imagesUsed = docs.reduce((acc, doc) => acc + (doc.images ? doc.images.length : 0), 0);
  }

  return { postsUsed, imagesUsed };
};

const getTodayVideoUploadsFromDB = async (PostModel, userId) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return await PostModel.countDocuments({
    user: userId,
    videoUrl: { $exists: true, $ne: '' },
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });
};

const isVideoUploadAllowed = (user, videoDurationSeconds = 0, videosUploadedToday = 0) => {
  const limits = computeAggregatedLimits(user);
  if (videoDurationSeconds > limits.maxVideoDurationSeconds) {
    return { allowed: false, reason: `Video duration exceeds the ${limits.maxVideoDurationSeconds}s limit.` };
  }
  if ((videosUploadedToday || 0) >= limits.postVideoDailyLimit) {
    return { allowed: false, reason: 'You have reached the video upload limit for today.' };
  }
  return { allowed: true };
};

const MAX_IMAGES = DEFAULTS.imagesPerMessage;

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

module.exports = {
  // Compatibility exports used across the codebase
  MAX_IMAGES_PER_POST,
  computeAggregatedLimits,
  getTodayUsageFromDB,
  getRemainingUsageToday,
  canCreatePostToday,
  canSendImageToday,
  getTodayVideoUploadsFromDB,
  isVideoUploadAllowed,
};

/**
 * Simplified subscription helpers — payments and subscription plans removed.
 * Default limits are enforced here and admin overrides on the User model are respected.
 *
 * Rules implemented:
 * - Posts per day: default 1 (user.postUploadLimitPerDay overrides)
 * - Post videos per day: default 1 (admin can override user.postVideoLimitPerDay)
 * - Message images per user (active in storage / last 5 days): max 10
 * - Images per message: up to 10
 * - Image retention: 5 days
 * - Message retention: 15 days
 * - Message videos per user per day: 5
 * - All videos max duration: 30 seconds
 */

const MAX_IMAGES_PER_POST = 2;

const DEFAULTS = {
  imagesPerMessage: 10,
  postsPerDay: 1,
  totalPostImagesPerDay: 2,
    imagesRetentionDays: 5,
    messagesRetentionDays: 15,
  postVideoDailyLimit: 1,
  messageVideoDailyLimit: 5,
  maxVideoDurationSeconds: 30,
};

const computeAggregatedLimits = (user) => {
  // Respect admin overrides on the user document when present
  const postsPerDay = (user && typeof user.postUploadLimitPerDay === 'number') ? user.postUploadLimitPerDay : DEFAULTS.postsPerDay;
  const postVideoDailyLimit = (user && typeof user.postVideoLimitPerDay === 'number') ? user.postVideoLimitPerDay : DEFAULTS.postVideoDailyLimit;
  const imagesPerMessage = DEFAULTS.imagesPerMessage;
  const messageVideoDailyLimit = DEFAULTS.messageVideoDailyLimit;

  return {
    imagesPerMessage,
    postsPerDay,
    totalPostImagesPerDay: DEFAULTS.totalPostImagesPerDay,
    imagesRetentionDays: DEFAULTS.imagesRetentionDays,
    messagesRetentionDays: DEFAULTS.messagesRetentionDays,
    postVideoDailyLimit,
    messageVideoDailyLimit,
    maxVideoDurationSeconds: DEFAULTS.maxVideoDurationSeconds,
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

  let postsUsed = 0;
  let imagesUsed = 0;

  if (Model.modelName === 'Post') {
    postsUsed = docs.length;
    imagesUsed = docs.reduce((acc, doc) => acc + (doc.houseImages ? doc.houseImages.length : 0), 0);
  } else if (Model.modelName === 'Message') {
    postsUsed = docs.length;
    imagesUsed = docs.filter(doc => doc.imageUrl && doc.imageUrl.length > 0).length;
  } else {
    postsUsed = docs.length;
    imagesUsed = docs.reduce((acc, doc) => acc + (doc.images ? doc.images.length : 0), 0);
  }

  return { postsUsed, imagesUsed };
};

const getTodayVideoUploadsFromDB = async (PostModel, userId) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return await PostModel.countDocuments({
    user: userId,
    videoUrl: { $exists: true, $ne: '' },
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });
};

const isVideoUploadAllowed = (user, videoDurationSeconds = 0, videosUploadedToday = 0) => {
  const limits = computeAggregatedLimits(user);
  if (videoDurationSeconds > limits.maxVideoDurationSeconds) {
    return { allowed: false, reason: `Video duration exceeds the ${limits.maxVideoDurationSeconds}s limit.` };
  }
  if ((videosUploadedToday || 0) >= limits.postVideoDailyLimit) {
    return { allowed: false, reason: 'You have reached the video upload limit for today.' };
  }
  return { allowed: true };
};

const MAX_IMAGES = DEFAULTS.imagesPerMessage;

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

module.exports = {
  // Keep some names used elsewhere for compatibility
  MAX_IMAGES_PER_POST,
  computeAggregatedLimits,
  getTodayUsageFromDB,
  getRemainingUsageToday,
  canCreatePostToday,
  canSendImageToday,
  getTodayVideoUploadsFromDB,
  isVideoUploadAllowed,
};

/**
 * Plan definitions.
 * New lifetime fields for Free:
 *   - maxTotalMessageImages: total images across all messages (Free = 2)
 *   - maxTotalPostImages: total images across all posts (Free = 2)
 *   - maxTotalPosts: total posts (Free = 1, already present)
 */
const PLAN_FEATURES = {
  basic: {
    imagesPerMessage: 3,
    postsPerDay: 2,
    shopImages: 3,
    retentionDays: 7,
    totalPostImagesPerDay: 3,
    placesPerDay: 1,
    maxTotalPosts: Infinity,
    maxTotalMessageImages: Infinity,
    maxTotalPostImages: Infinity,
    shopImagesLifetime: 1,
    messageCooldownDays: 2,
    postCooldownDays: 2,
    shopCooldownDays: 0,
    messagesDailyLimit: 3,
    postsMapTotalImages: 3,
    price: 0,
    planLabel: 'Basic',
  },
  standard: {
    imagesPerMessage: 5,
    postsPerDay: 3,
    shopImages: 5,
    retentionDays: 8,
    totalPostImagesPerDay: 6,
    placesPerDay: 1,
    maxTotalPosts: Infinity,
    maxTotalMessageImages: Infinity,
    maxTotalPostImages: Infinity,
    shopImagesLifetime: 1,
    messageCooldownDays: 0,
    postCooldownDays: 0,
    shopCooldownDays: 0,
    messagesDailyLimit: 5,
    postsMapTotalImages: 6,
    price: 200,
    planLabel: 'Standard',
  },
  premium: {
    imagesPerMessage: 20,
    postsPerDay: 10,
    shopImages: 20,
    retentionDays: 10,
    totalPostImagesPerDay: 10,
    placesPerDay: 1,
    maxTotalPosts: Infinity,
    maxTotalMessageImages: Infinity,
    maxTotalPostImages: Infinity,
    shopImagesLifetime: 1,
    messageCooldownDays: 0,
    postCooldownDays: 0,
    shopCooldownDays: 0,
    messagesDailyLimit: 20,
    postsMapTotalImages: 10,
    price: 500,
    planLabel: 'Premium',
  },
  enterprise: {
    imagesPerMessage: Infinity,
    postsPerDay: 20,
    shopImages: 40,
    retentionDays: 15,
    totalPostImagesPerDay: 40,
    placesPerDay: 1,
    maxTotalPosts: Infinity,
    maxTotalMessageImages: Infinity,
    maxTotalPostImages: Infinity,
    shopImagesLifetime: 1,
    messageCooldownDays: 0,
    postCooldownDays: 0,
    shopCooldownDays: 0,
    messagesDailyLimit: Infinity,
    postsMapTotalImages: 40,
    price: 20000,
    planLabel: 'Enterprise',
  },
};

const FREE_PLAN = {
  imagesPerMessage: 2,
  postsPerDay: 1,
  shopImages: 1,
  retentionDays: 4,
  totalPostImagesPerDay: 2,
  placesPerDay: 1,
  maxTotalPosts: 1,
  maxTotalMessageImages: 2,
  maxTotalPostImages: 2,
  shopImagesLifetime: 1,
  messageCooldownDays: 0,
  postCooldownDays: 0,
  shopCooldownDays: 0,
  messagesDailyLimit: 0,
  postsMapTotalImages: 2,
  price: 0,
  planLabel: 'Free',
};

const VIDEO_PLAN_FEATURES = {
  free: {
    price: 0,
    planLabel: 'Free',
    canUploadVideo: false,
    maxVideoDuration: 0,
    dailyVideoLimit: 0,
  },
  basic: {
    price: 5000,
    planLabel: 'Basic',
    canUploadVideo: true,
    maxVideoDuration: 60,
    dailyVideoLimit: 2,
  },
  premium: {
    price: 20000,
    planLabel: 'Premium',
    canUploadVideo: true,
    maxVideoDuration: 120,
    dailyVideoLimit: 6,
  },
  standard: {
    price: 5000,
    planLabel: 'Basic',
    canUploadVideo: true,
    maxVideoDuration: 60,
    dailyVideoLimit: 2,
  },
  enterprise: {
    price: 20000,
    planLabel: 'Premium',
    canUploadVideo: true,
    maxVideoDuration: 120,
    dailyVideoLimit: 6,
  },
  business: {
    price: 20000,
    planLabel: 'Premium',
    canUploadVideo: true,
    maxVideoDuration: 120,
    dailyVideoLimit: 6,
  },
};

const VIDEO_PLAN_ORDER = ['free', 'basic', 'premium'];

const normalizeVideoPlan = (plan) => {
  if (!plan) return 'free';
  const normalized = String(plan).toLowerCase();
  if (['basic', 'standard'].includes(normalized)) return 'basic';
  if (['premium', 'enterprise', 'business'].includes(normalized)) return 'premium';
  return 'free';
};

const getActiveVideoSubscriptions = (user) => {
  const now = new Date();
  return (user.paymentHistory || [])
    .filter(p => p.status === 'success' && p.expiryDate && new Date(p.expiryDate) > now)
    .map(p => ({
      ...p,
      plan: normalizeVideoPlan(p.plan),
    }))
    .filter(p => VIDEO_PLAN_FEATURES[p.plan]);
};

const getHighestVideoSubscription = (user) => {
  const activePayments = getActiveVideoSubscriptions(user);
  if (activePayments.length === 0) return null;
  return activePayments.reduce((best, payment) => {
    if (!best) return payment;
    const currentIndex = VIDEO_PLAN_ORDER.indexOf(payment.plan);
    const bestIndex = VIDEO_PLAN_ORDER.indexOf(best.plan);
    if (currentIndex > bestIndex) return payment;
    if (currentIndex === bestIndex && new Date(payment.expiryDate) > new Date(best.expiryDate)) return payment;
    return best;
  }, null);
};

const getVideoPlanPriceText = () => {
  const prices = Array.from(new Set(Object.values(VIDEO_PLAN_FEATURES)
    .filter(plan => plan.canUploadVideo)
    .map(plan => plan.price)))
    .sort((a, b) => a - b);
  return prices.map(p => `${p} RWF`).join(' or ');
};

const getSubscription = (user, videosUploadedToday = 0) => {
  const highestVideoPayment = getHighestVideoSubscription(user);
  const planKey = highestVideoPayment ? highestVideoPayment.plan : 'free';
  const features = VIDEO_PLAN_FEATURES[planKey] || VIDEO_PLAN_FEATURES.free;
  const uploadsRemaining = Math.max(features.dailyVideoLimit - (videosUploadedToday || 0), 0);
  const hasActiveVideoPlan = !!highestVideoPayment && features.canUploadVideo;
  const subscriptionStatus = hasActiveVideoPlan ? 'active' : 'free';

  return {
    subscriptionPlan: planKey,
    subscriptionPlanLabel: features.planLabel,
    paymentAmount: features.price,
    canUploadVideo: features.canUploadVideo,
    maxVideoDuration: features.maxVideoDuration,
    dailyVideoLimit: features.dailyVideoLimit,
    videosUploadedToday: videosUploadedToday || 0,
    uploadsRemaining,
    subscriptionStatus,
    expiresAt: highestVideoPayment ? highestVideoPayment.expiryDate : null,
  };
};

const getSubscriptionInfo = getSubscription;

const hasPremium = (user) => getSubscription(user).subscriptionPlan === 'premium';

const isSubscribed = (user) => getSubscription(user).canUploadVideo;

const canUploadVideo = (user, videosUploadedToday = 0) => getSubscription(user, videosUploadedToday).canUploadVideo;

const getVideoLimit = (user) => getSubscription(user).dailyVideoLimit;

const getRemainingUploads = (user, videosUploadedToday = 0) => getSubscription(user, videosUploadedToday).uploadsRemaining;

const getMaxVideoDuration = (user) => getSubscription(user).maxVideoDuration;

const isVideoUploadAllowed = (user, videoDurationSeconds = 0, videosUploadedToday = 0) => {
  const subscription = getSubscription(user, videosUploadedToday);
  if (!subscription.canUploadVideo) {
    return {
      allowed: false,
      reason: `You need to pay ${getVideoPlanPriceText()} to upload videos.`,
      subscription,
    };
  }
  if (videoDurationSeconds > subscription.maxVideoDuration) {
    return {
      allowed: false,
      reason: `Your plan allows videos up to ${subscription.maxVideoDuration} seconds.`,
      subscription,
    };
  }
  if (subscription.uploadsRemaining <= 0) {
    return {
      allowed: false,
      reason: 'You have reached today\'s upload limit.',
      subscription,
    };
  }
  return { allowed: true, subscription };
};

const getTodayVideoUploadsFromDB = async (PostModel, userId) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return await PostModel.countDocuments({
    user: userId,
    videoUrl: { $exists: true, $ne: '' },
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });
};

const MAX_IMAGES_PER_POST = 2;

/**
 * Compute aggregated limits.
 * Summed fields: imagesPerMessage, postsPerDay, shopImages, totalPostImagesPerDay, placesPerDay
 * Max fields: retentionDays, maxTotalPosts, maxTotalMessageImages, maxTotalPostImages, shopImagesLifetime
 * Cooldowns: minimum (0 = no cooldown)
 */
const computeAggregatedLimits = (user) => {
  const now = new Date();
  let total = { ...FREE_PLAN };
  let maxRetention = FREE_PLAN.retentionDays;
  let maxTotalPosts = FREE_PLAN.maxTotalPosts;
  let maxTotalMsgImages = FREE_PLAN.maxTotalMessageImages;
  let maxTotalPostImages = FREE_PLAN.maxTotalPostImages;
  let maxShopLifetime = FREE_PLAN.shopImagesLifetime;

  let minMsgCooldown = FREE_PLAN.messageCooldownDays;
  let minPostCooldown = FREE_PLAN.postCooldownDays;
  let minShopCooldown = FREE_PLAN.shopCooldownDays;

  const activePayments = (user.paymentHistory || []).filter(
    p => p.status === 'success' && p.expiryDate && new Date(p.expiryDate) > now
  );

  activePayments.forEach(payment => {
    const features = PLAN_FEATURES[payment.plan];
    if (!features) return;

    // Summed
    total.imagesPerMessage += features.imagesPerMessage;
    total.postsPerDay += features.postsPerDay;
    total.shopImages += features.shopImages;
    total.totalPostImagesPerDay += features.totalPostImagesPerDay;
    total.placesPerDay += features.placesPerDay;

    // Max
    if (features.retentionDays > maxRetention) maxRetention = features.retentionDays;
    if (features.maxTotalPosts > maxTotalPosts) maxTotalPosts = features.maxTotalPosts;
    if (features.maxTotalMessageImages > maxTotalMsgImages) maxTotalMsgImages = features.maxTotalMessageImages;
    if (features.maxTotalPostImages > maxTotalPostImages) maxTotalPostImages = features.maxTotalPostImages;
    if (features.shopImagesLifetime > maxShopLifetime) maxShopLifetime = features.shopImagesLifetime;

    // Min cooldown
    if (features.messageCooldownDays < minMsgCooldown) minMsgCooldown = features.messageCooldownDays;
    if (features.postCooldownDays < minPostCooldown) minPostCooldown = features.postCooldownDays;
    if (features.shopCooldownDays < minShopCooldown) minShopCooldown = features.shopCooldownDays;

    // Infinity handling
    if (features.imagesPerMessage === Infinity) total.imagesPerMessage = Infinity;
    if (features.shopImages === Infinity) total.shopImages = Infinity;
    if (features.totalPostImagesPerDay === Infinity) total.totalPostImagesPerDay = Infinity;
  });

total.retentionDays = maxRetention;
  total.maxTotalPosts = maxTotalPosts;
  total.maxTotalMessageImages = maxTotalMsgImages;
  total.maxTotalPostImages = maxTotalPostImages;
  total.shopImagesLifetime = maxShopLifetime;
  total.messageCooldownDays = minMsgCooldown;
  total.postCooldownDays = minPostCooldown;
  total.shopCooldownDays = minShopCooldown;

  // --- New aggregated fields for the frontend helper ---
  // messagesDailyLimit: max of all active plans (with Infinity support)
  let msgLimit = FREE_PLAN.messagesDailyLimit;
  let postMapTotal = FREE_PLAN.postsMapTotalImages;
  activePayments.forEach(payment => {
    const features = PLAN_FEATURES[payment.plan];
    if (!features) return;
    if (features.messagesDailyLimit > msgLimit || features.messagesDailyLimit === Infinity) msgLimit = features.messagesDailyLimit;
    if (features.postsMapTotalImages > postMapTotal || features.postsMapTotalImages === Infinity) postMapTotal = features.postsMapTotalImages;
  });
total.messagesDailyLimit = msgLimit;
  total.postsMapTotalImages = postMapTotal;

  // Plan label & price from the highest active plan
  const planOrder = ['free', 'basic', 'standard', 'premium', 'enterprise'];
  let highestPlan = 'free';
  let highestLabel = 'Free';
  let highestPrice = 0;
  activePayments.forEach(payment => {
    const features = PLAN_FEATURES[payment.plan];
    if (!features) return;
    const idx = planOrder.indexOf(payment.plan);
    if (idx > planOrder.indexOf(highestPlan)) {
      highestPlan = payment.plan;
      highestLabel = features.planLabel || payment.planName;
      highestPrice = features.price || payment.amount;
    }
  });
  total.plan = highestPlan;
  total.planLabel = highestLabel;
  total.price = highestPrice;
  total.messagesDurationDays = 30;
  total.messagesAutoDeleteDays = total.retentionDays;

  return total;
};

// ---------- Daily usage functions ----------
const getTodayUsageFromDB = async (Model, userId) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  let queryField = 'user';
  if (Model.modelName === 'Message') {
    queryField = 'senderId';
  }

  const query = {
    [queryField]: userId,
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  };

  const docs = await Model.find(query);

  let postsUsed = 0;
  let imagesUsed = 0;

  if (Model.modelName === 'Post') {
    postsUsed = docs.length;
    imagesUsed = docs.reduce((acc, doc) => acc + (doc.houseImages ? doc.houseImages.length : 0), 0);
  } else if (Model.modelName === 'Message') {
    postsUsed = docs.length;
    imagesUsed = docs.filter(doc => doc.imageUrl && doc.imageUrl.length > 0).length;
  } else {
    postsUsed = docs.length;
    imagesUsed = docs.reduce((acc, doc) => acc + (doc.images ? doc.images.length : 0), 0);
  }

  return { postsUsed, imagesUsed };
};

const getRemainingUsageToday = async (user, Model, todayUsage = null) => {
  const limits = computeAggregatedLimits(user);
  let usage = todayUsage;
  if (!usage) {
    usage = await getTodayUsageFromDB(Model, user._id);
  }

  const remainingPosts = Math.max(limits.postsPerDay - usage.postsUsed, 0);
  const remainingPostImages = Math.min(
    limits.totalPostImagesPerDay - usage.imagesUsed,
    remainingPosts * MAX_IMAGES_PER_POST
  );
  const remainingMessageImages = Math.max(limits.imagesPerMessage - usage.imagesUsed, 0);

  return {
    ...usage,
    remainingPosts,
    remainingPostImages: Math.max(remainingPostImages, 0),
    remainingMessageImages,
    remainingImages: Math.max(remainingMessageImages, 0),
  };
};

// --- Simple daily checks (no cooldown/lifetime) ---
const canCreatePostToday = async (user, PostModel, todayUsage = null) => {
  const { remainingPosts } = await getRemainingUsageToday(user, PostModel, todayUsage);
  return remainingPosts > 0;
};

const canSendImageToday = async (user, MessageModel, todayUsage = null) => {
  const { remainingMessageImages } = await getRemainingUsageToday(user, MessageModel, todayUsage);
  return remainingMessageImages > 0;
};

const canAddImageToPostToday = async (user, PostModel, todayUsage = null) => {
  const { remainingPostImages } = await getRemainingUsageToday(user, PostModel, todayUsage);
  return remainingPostImages > 0;
};

// ---------- Places usage helpers (NEW – added to fix the error) ----------
const getTodayPlacesUsageFromDB = async (PlaceModel, userId) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const places = await PlaceModel.find({
    userId: userId,
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });
  return places.length;
};

const canCreatePlaceToday = async (user, PlaceModel) => {
  const limits = computeAggregatedLimits(user);
  const placesUsed = await getTodayPlacesUsageFromDB(PlaceModel, user._id);
  return placesUsed < limits.placesPerDay;
};

// ---------- Lifetime usage functions (for Free plan) ----------
const getTotalMessageImagesUsed = async (MessageModel, userId) => {
  const messages = await MessageModel.find({ senderId: userId });
  return messages.filter(m => m.imageUrl && m.imageUrl.length > 0).length;
};

const getTotalPostImagesUsed = async (PostModel, userId) => {
  const posts = await PostModel.find({ user: userId });
  return posts.reduce((acc, p) => acc + (p.houseImages ? p.houseImages.length : 0), 0);
};

const canSendMessageImageLifetime = async (user, MessageModel) => {
  const limits = computeAggregatedLimits(user);
  if (limits.maxTotalMessageImages === Infinity) return { allowed: true };
  const used = await getTotalMessageImagesUsed(MessageModel, user._id);
  if (used >= limits.maxTotalMessageImages) {
    return { allowed: false, reason: 'Lifetime message image limit reached.' };
  }
  return { allowed: true };
};

const canAddPostImageLifetime = async (user, PostModel) => {
  const limits = computeAggregatedLimits(user);
  if (limits.maxTotalPostImages === Infinity) return { allowed: true };
  const used = await getTotalPostImagesUsed(PostModel, user._id);
  if (used >= limits.maxTotalPostImages) {
    return { allowed: false, reason: 'Lifetime post image limit reached.' };
  }
  return { allowed: true };
};

// ---------- Cooldown checks ----------
const canSendMessageWithCooldown = async (user, MessageModel) => {
  const limits = computeAggregatedLimits(user);
  if (limits.messageCooldownDays === 0) return { allowed: true };

  const last = await MessageModel.findOne({ senderId: user._id }).sort({ createdAt: -1 });
  if (!last) return { allowed: true };

  const cooldownMs = limits.messageCooldownDays * 24 * 60 * 60 * 1000;
  const timeSince = Date.now() - new Date(last.createdAt).getTime();
  if (timeSince < cooldownMs) {
    const remaining = Math.ceil((cooldownMs - timeSince) / (60 * 60 * 1000));
    return {
      allowed: false,
      reason: `You can send another message with images in ${remaining} hour(s).`,
      cooldownHours: remaining,
    };
  }
  return { allowed: true };
};

const canCreatePostWithCooldown = async (user, PostModel) => {
  const limits = computeAggregatedLimits(user);
  if (limits.postCooldownDays === 0) return { allowed: true };

  const last = await PostModel.findOne({ user: user._id }).sort({ createdAt: -1 });
  if (!last) return { allowed: true };

  const cooldownMs = limits.postCooldownDays * 24 * 60 * 60 * 1000;
  const timeSince = Date.now() - new Date(last.createdAt).getTime();
  if (timeSince < cooldownMs) {
    const remaining = Math.ceil((cooldownMs - timeSince) / (60 * 60 * 1000));
    return {
      allowed: false,
      reason: `You can create another post in ${remaining} hour(s).`,
      cooldownHours: remaining,
    };
  }
  return { allowed: true };
};

const canUpdateShopWithCooldown = async (user, ShopModel) => {
  const limits = computeAggregatedLimits(user);
  if (limits.shopCooldownDays === 0) return { allowed: true };

  const last = await ShopModel.findOne({ userId: user._id }).sort({ updatedAt: -1 });
  if (!last) return { allowed: true };

  const cooldownMs = limits.shopCooldownDays * 24 * 60 * 60 * 1000;
  const timeSince = Date.now() - new Date(last.updatedAt).getTime();
  if (timeSince < cooldownMs) {
    const remaining = Math.ceil((cooldownMs - timeSince) / (60 * 60 * 1000));
    return {
      allowed: false,
      reason: `You can update your shop again in ${remaining} hour(s).`,
      cooldownHours: remaining,
    };
  }
  return { allowed: true };
};

/**
 * Get remaining shop image lifetime (total images allowed).
 */
const getShopLifetimeRemaining = async (user, ShopModel) => {
  const limits = computeAggregatedLimits(user);
  const result = await ShopModel.aggregate([
    { $match: { userId: user._id } },
    { $group: { _id: null, total: { $sum: { $size: '$images' } } } }
  ]);
  const used = result.length > 0 ? result[0].total : 0;
  return Math.max(limits.shopImagesLifetime - used, 0);
};

/**
 * Get the list of currently active subscriptions.
 */
const getActiveSubscriptions = (user) => {
  const now = new Date();
  return (user.paymentHistory || [])
    .filter(p => p.status === 'success' && p.expiryDate && new Date(p.expiryDate) > now)
    .map(p => ({
      plan: p.plan,
      planName: p.planName,
      amount: p.amount,
      currency: p.currency || 'RWF',
      expiryDate: p.expiryDate,
      paymentDate: p.paymentDate,
      transactionId: p.transactionId,
    }));
};

// --- Legacy functions ---
const getRemainingUsage = (user, todayUsage = {}) => {
  const limits = computeAggregatedLimits(user);
  const postsUsed = todayUsage.postsUsed || 0;
  const imagesUsed = todayUsage.imagesUsed || 0;
  const remainingPosts = Math.max(limits.postsPerDay - postsUsed, 0);
  const remainingImages = Math.max(limits.imagesPerMessage - imagesUsed, 0);
  return { remainingPosts, remainingImages, postsUsed, imagesUsed };
};

const canSendImage = (user, todayUsage) => {
  const { remainingImages } = getRemainingUsage(user, todayUsage);
  return remainingImages > 0;
};

const canCreatePost = (user, todayUsage) => {
  const { remainingPosts } = getRemainingUsage(user, todayUsage);
  return remainingPosts > 0;
};

module.exports = {
  PLAN_FEATURES,
  FREE_PLAN,
  MAX_IMAGES_PER_POST,
  computeAggregatedLimits,
  getTodayUsageFromDB,
  getRemainingUsageToday,
  canCreatePostToday,
  canSendImageToday,
  canAddImageToPostToday,
  getTodayPlacesUsageFromDB,      // ✅ now defined
  canCreatePlaceToday,           // ✅ now defined
  getActiveSubscriptions,
  // Video subscription helpers
  VIDEO_PLAN_FEATURES,
  getActiveVideoSubscriptions,
  getSubscription,
  getSubscriptionInfo,
  hasPremium,
  isSubscribed,
  canUploadVideo,
  getVideoLimit,
  getRemainingUploads,
  getMaxVideoDuration,
  isVideoUploadAllowed,
  getTodayVideoUploadsFromDB,
  // Cooldown & lifetime
  canSendMessageWithCooldown,
  canCreatePostWithCooldown,
  canUpdateShopWithCooldown,
  getShopLifetimeRemaining,
  canSendMessageImageLifetime,
  canAddPostImageLifetime,
  getTotalMessageImagesUsed,
  getTotalPostImagesUsed,
  // Legacy
  getRemainingUsage,
  canSendImage,
  canCreatePost,
};