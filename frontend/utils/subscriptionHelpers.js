// utils/subscriptionHelpers.js (FRONTEND)

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

const MAX_IMAGES_PER_POST = 2;

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

    total.imagesPerMessage += features.imagesPerMessage;
    total.postsPerDay += features.postsPerDay;
    total.shopImages += features.shopImages;
    total.totalPostImagesPerDay += features.totalPostImagesPerDay;
    total.placesPerDay += features.placesPerDay;

    if (features.retentionDays > maxRetention) maxRetention = features.retentionDays;
    if (features.maxTotalPosts > maxTotalPosts) maxTotalPosts = features.maxTotalPosts;
    if (features.maxTotalMessageImages > maxTotalMsgImages) maxTotalMsgImages = features.maxTotalMessageImages;
    if (features.maxTotalPostImages > maxTotalPostImages) maxTotalPostImages = features.maxTotalPostImages;
    if (features.shopImagesLifetime > maxShopLifetime) maxShopLifetime = features.shopImagesLifetime;

    if (features.messageCooldownDays < minMsgCooldown) minMsgCooldown = features.messageCooldownDays;
    if (features.postCooldownDays < minPostCooldown) minPostCooldown = features.postCooldownDays;
    if (features.shopCooldownDays < minShopCooldown) minShopCooldown = features.shopCooldownDays;

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
  let msgLimit = FREE_PLAN.messagesDailyLimit;
  let postMapTotal = FREE_PLAN.postsMapTotalImages;
  let highestPlan = 'free';
  let highestLabel = 'Free';
  let highestPrice = 0;
  const planOrder = ['free', 'basic', 'standard', 'premium', 'enterprise'];
  activePayments.forEach(payment => {
    const features = PLAN_FEATURES[payment.plan];
    if (!features) return;
    if (features.messagesDailyLimit > msgLimit || features.messagesDailyLimit === Infinity) msgLimit = features.messagesDailyLimit;
    if (features.postsMapTotalImages > postMapTotal || features.postsMapTotalImages === Infinity) postMapTotal = features.postsMapTotalImages;
    const idx = planOrder.indexOf(payment.plan);
    if (idx > planOrder.indexOf(highestPlan)) {
      highestPlan = payment.plan;
      highestLabel = features.planLabel || payment.planName;
      highestPrice = features.price || payment.amount;
    }
  });

  // Compute usage from user data
  const dailyMessagesUsed = user.dailyMessagesUsed !== undefined ? user.dailyMessagesUsed : (user.messageImagesToday || 0);
  const postsMapUsedImages = user.postsToday !== undefined
    ? Math.min(user.postsToday * 2, postMapTotal)
    : 0;
  const postsMapRemainingImages = Math.max(postMapTotal - postsMapUsedImages, 0);
  const messagesRemainingToday = msgLimit === Infinity ? Infinity : Math.max(msgLimit - dailyMessagesUsed, 0);

  total.messagesDailyLimit = msgLimit;
  total.messagesDailyUsed = dailyMessagesUsed;
  total.messagesRemainingToday = messagesRemainingToday;
  total.postsMapTotalImages = postMapTotal;
  total.postsMapUsedImages = postsMapUsedImages;
  total.postsMapRemainingImages = postsMapRemainingImages;
  total.messagesAutoDeleteDays = total.retentionDays;
  total.messagesDurationDays = 30;
  total.plan = highestPlan;
  total.planLabel = highestLabel;
  total.price = highestPrice;

  if (Number.isSafeInteger(user.postUploadLimitPerDay)) {
    total.postsPerDay = user.postUploadLimitPerDay;
    total.totalPostImagesPerDay = user.postUploadLimitPerDay * MAX_IMAGES_PER_POST;
    total.maxTotalPosts = Infinity;
    total.maxTotalPostImages = Infinity;
  }
  if (Number.isSafeInteger(user.imagesPerMessage)) total.imagesPerMessage = user.imagesPerMessage;
  if (Number.isSafeInteger(user.imagesRetentionDays)) {
    total.retentionDays = user.imagesRetentionDays;
    total.messagesAutoDeleteDays = user.imagesRetentionDays;
  }
  if (Number.isSafeInteger(user.messagesRetentionDays)) {
    total.messagesDurationDays = user.messagesRetentionDays;
  }
  if (Number.isSafeInteger(user.placeProductUploadLimitPerDay)) {
    total.placeProductsPerDay = user.placeProductUploadLimitPerDay;
  }
  if (Number.isSafeInteger(user.mallProductUploadLimitPerDay)) {
    total.mallProductsPerDay = user.mallProductUploadLimitPerDay;
  }
  if (Number.isSafeInteger(user.videoUploadLimitPerDay)) {
    total.videoUploadsPerDay = user.videoUploadLimitPerDay;
  }
  if (Number.isSafeInteger(user.shopUploadLimitLifetime)) {
    total.shopsLifetime = user.shopUploadLimitLifetime;
  }
  if (Number.isSafeInteger(user.mallShopUploadLimitLifetime)) {
    total.mallShopsLifetime = user.mallShopUploadLimitLifetime;
  }

  return total;
};

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

module.exports = {
  PLAN_FEATURES,
  FREE_PLAN,
  MAX_IMAGES_PER_POST,
  computeAggregatedLimits,
  getActiveSubscriptions,
};
