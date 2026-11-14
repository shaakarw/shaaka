// controllers/mallShopController.js
const MallShop = require('../models/MallShop');
const User = require('../models/User');
const Place = require('../models/Place');
const { deleteMallShopWithCleanup } = require('../utils/deletionCleanup');
const { normalizeRwandaPhone } = require('../utils/phoneNormalizer');
const { notifyUsers } = require('../services/notificationService');
const storageService = require('../services/storage/storageService');
const { resolveStoredImageUrl } = require('../utils/storedImageUrl');
const { DEFAULT_USER_PERMISSIONS } = require('../config/userPermissions');
const {
  getDailyUsage,
  getLifetimeUsage,
  getNextDailyReset,
  reserveDailyUsage,
  releaseDailyUsage,
  reserveLifetimeUsage,
  releaseLifetimeUsage,
} = require('../utils/permissionUsage');

const normalizeMallShopImageUrls = shop => {
  const result = typeof shop.toObject === 'function' ? shop.toObject() : { ...shop };
  result.images = {
    ...result.images,
    frontImage: resolveStoredImageUrl(
      result.images?.frontImage,
      result.frontImageStorageKey,
      storageService
    ),
  };
  result.products = (result.products || []).map(product => {
    const normalizedProduct = typeof product.toObject === 'function'
      ? product.toObject()
      : { ...product };
    normalizedProduct.images = (normalizedProduct.images || []).map((image, index) => (
      resolveStoredImageUrl(
        image,
        normalizedProduct.imageStorageKeys?.[index],
        storageService
      )
    ));
    return normalizedProduct;
  });
  return result;
};

const getProductSignature = product => JSON.stringify({
  name: product?.name ?? '',
  price: product?.price ?? null,
  images: Array.isArray(product?.imageStorageKeys) && product.imageStorageKeys.length
    ? product.imageStorageKeys
    : (Array.isArray(product?.images) ? product.images : [])
      .map(image => storageService.getStorageKeyFromUrl(image) || image),
});

const countAddedProducts = (existingProducts, updatedProducts) => {
  const remainingProducts = new Map();
  for (const product of existingProducts) {
    const signature = getProductSignature(product);
    remainingProducts.set(signature, (remainingProducts.get(signature) || 0) + 1);
  }

  let addedProducts = 0;
  for (const product of updatedProducts) {
    const signature = getProductSignature(product);
    const count = remainingProducts.get(signature) || 0;
    if (count) remainingProducts.set(signature, count - 1);
    else addedProducts += 1;
  }
  return addedProducts;
};

// Create a new shop inside a mall
exports.createMallShop = async (req, res) => {
  const quotaRequestTime = new Date();
  let reservedMallShopLifetime = false;
  let reservedMallProducts = 0;
  try {
    const {
      mallId,
      mallName,
      name,
      description,
      category,
      shopNumber,
      floorNumber,
      address,
      phone,
      whatsapp,
      email,
      website,
      openingTime,
      closingTime,
      images,
      imageVariants,
      products,
      lat,
      lon,
    } = req.body;

    if (products !== undefined && !Array.isArray(products)) {
      return res.status(400).json({ success: false, message: 'Products must be provided as a list.' });
    }
    const productList = Array.isArray(products) ? products : [];
    const normalizedProducts = productList.map(product => ({
      ...product,
      imageVariants: Array.isArray(product.imageVariants) ? product.imageVariants : [],
      imageStorageKeys: storageService.collectStorageKeys
        ? storageService.collectStorageKeys(product.images || [])
        : (product.images || []).map(storageService.getStorageKeyFromUrl).filter(Boolean),
    }));

    const frontImageStorageKey = storageService.getStorageKeyFromUrl(images?.frontImage) || '';

    // Validate required fields
    const hasFrontImage = images && images.frontImage;
    if (!mallId || !name || !shopNumber || !phone || !hasFrontImage) {
      return res.status(400).json({ success: false, message: 'Missing required fields (front image required)' });
    }

    const normalizedPhone = normalizeRwandaPhone(phone);
    if (!normalizedPhone || !/^\+2507[983]\d{7}$/.test(normalizedPhone)) {
      return res.status(400).json({ success: false, message: 'Please enter a 10-digit Rwanda phone number starting with 079, 078, or 073' });
    }
    const normalizedWhatsApp = whatsapp ? normalizeRwandaPhone(whatsapp) : '';
    if (whatsapp && (!normalizedWhatsApp || !/^\+2507[983]\d{7}$/.test(normalizedWhatsApp))) {
      return res.status(400).json({ success: false, message: 'Please enter a 10-digit WhatsApp number starting with 079, 078, or 073, or leave it empty' });
    }

    // One-type-only rule: user cannot have both a normal place/shop and a shopping mall shop
    const userId = req.user.id;
    const existingPlaceCount = await getLifetimeUsage(userId, 'shops_places');
    if (existingPlaceCount > 0) {
      return res.status(403).json({ success: false, message: 'You already have a Shop/Place. You cannot add a Shopping Mall Shop.' });
    }

    // Enforce lifetime mall shop limit per user (default 1, admin override supported)
    const user = await User.findById(userId).select('mallShopUploadLimitLifetime mallProductUploadLimitPerDay');
    const maxMallShopsLifetime = Number.isSafeInteger(user?.mallShopUploadLimitLifetime)
      ? user.mallShopUploadLimitLifetime
      : DEFAULT_USER_PERMISSIONS.mallShopUploadLimitLifetime;
    const maxProductsPerDay = Number.isSafeInteger(user?.mallProductUploadLimitPerDay)
      ? user.mallProductUploadLimitPerDay
      : DEFAULT_USER_PERMISSIONS.mallProductUploadLimitPerDay;

    const existingMallShopsCount = await getLifetimeUsage(userId, 'mall_shops');
    if (existingMallShopsCount >= maxMallShopsLifetime) {
      return res.status(403).json({ success: false, message: `You have reached your lifetime shopping mall shop limit. Maximum ${maxMallShopsLifetime} shop.` });
    }

    // Ensure each product has at most one image and enforce daily product limit
    for (const prod of productList) {
      if (prod.images && prod.images.length > 1) {
        return res.status(400).json({ success: false, message: 'Each product can contain only one image.' });
      }
    }
    if (productList.length) {
      const productsToday = await getDailyUsage(userId, 'mall_products', quotaRequestTime);
      if (productsToday + productList.length > maxProductsPerDay) {
        return res.status(403).json({
          success: false,
          message: `Daily product limit reached. Maximum ${maxProductsPerDay} products per day.`,
          resetsAt: getNextDailyReset(quotaRequestTime).toISOString(),
        });
      }
    }
    reservedMallShopLifetime = await reserveLifetimeUsage(
      userId,
      'mall_shops',
      1,
      maxMallShopsLifetime
    );
    if (!reservedMallShopLifetime) {
      return res.status(403).json({ success: false, message: `You have reached your lifetime shopping mall shop limit. Maximum ${maxMallShopsLifetime} shop.` });
    }
    if (productList.length) {
      const productsReserved = await reserveDailyUsage(
        userId,
        'mall_products',
        productList.length,
        maxProductsPerDay,
        quotaRequestTime
      );
      if (!productsReserved) {
        await releaseLifetimeUsage(userId, 'mall_shops', 1);
        reservedMallShopLifetime = false;
        return res.status(403).json({
          success: false,
          message: `Daily product limit reached. Maximum ${maxProductsPerDay} products per day.`,
          resetsAt: getNextDailyReset(quotaRequestTime).toISOString(),
        });
      }
      reservedMallProducts = productList.length;
    }

    const ownerId = req.user.id;

    const shop = new MallShop({
      mallId,
      mallName,
      ownerId,
      name,
      description,
      category,
      shopNumber,
      floorNumber,
      address,
      phone: normalizedPhone,
      whatsapp: normalizedWhatsApp,
      email,
      website,
      openingTime,
      closingTime,
      images,
      imageVariants: Array.isArray(imageVariants) ? imageVariants : [],
      frontImageStorageKey,
      storageProvider: 'b2',
      products: normalizedProducts,
      lat,
      lon,
      createdDate: new Date(),
    });

    await shop.save();
    reservedMallShopLifetime = false;
    reservedMallProducts = 0;
    try {
      await notifyUsers({
        type: 'NEW_MALL_SHOP',
        title: shop.name,
        message: 'New shop added to shopping mall',
        image: shop.images?.frontImage || '',
        mallShopId: shop._id,
        shoppingMallId: shop.mallId,
        actorId: ownerId,
      });
    } catch (notificationError) {
      console.error('New mall shop notification error:', notificationError);
    }

    res.status(201).json({ success: true, shop });
  } catch (error) {
    const releases = [];
    if (reservedMallShopLifetime) releases.push(releaseLifetimeUsage(req.user.id, 'mall_shops', 1));
    if (reservedMallProducts) {
      releases.push(releaseDailyUsage(req.user.id, 'mall_products', reservedMallProducts, quotaRequestTime));
    }
    await Promise.all(releases.map(release => release.catch(releaseError => {
      console.error('[Permissions] Could not release failed mall shop quota:', releaseError.code || releaseError.message);
    })));
    console.error('Error creating mall shop:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get all shops for a specific mall
exports.getMallShopsByMall = async (req, res) => {
  try {
    const { mallId } = req.query;
    if (!mallId) {
      return res.status(400).json({ success: false, message: 'mallId query parameter required' });
    }

    const shops = await MallShop.find({ mallId })
      .populate('ownerId', 'name username avatar')
      .sort({ createdDate: -1 });
    res.json({ success: true, shops: shops.map(normalizeMallShopImageUrls) });
  } catch (error) {
    console.error('Error fetching mall shops:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get a single shop by ID
exports.getMallShopById = async (req, res) => {
  try {
    const { id } = req.params;
    const shop = await MallShop.findById(id).populate('ownerId', 'name username avatar phone');
    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }
    res.json({ success: true, shop: normalizeMallShopImageUrls(shop) });
  } catch (error) {
    console.error('Error fetching mall shop:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------- SEARCH SHOPS ACROSS ALL MALLS ----------
/**
 * @route GET /api/mall-shops/search
 * @param {string} req.query.q - search query
 * @returns {Array} shops - list of matching shops with mall info
 */
exports.searchMallShops = async (req, res) => {
  try {
    const query = req.query.q || '';
    if (!query.trim()) {
      return res.json({ success: true, shops: [] });
    }

    // Build search filters – these fields exist in your schema
    const filters = [
      { name: { $regex: query, $options: 'i' } },
      { category: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { mallName: { $regex: query, $options: 'i' } },
      { shopNumber: { $regex: query, $options: 'i' } },
    ];

    const shops = await MallShop.find({ $or: filters })
      .populate('ownerId', 'name username avatar')
      .limit(20)
      .lean();

    // Format response to match frontend expectations
    const formatted = shops.map(shop => ({
      ...normalizeMallShopImageUrls(shop),
      mall: {
        name: shop.mallName || 'Unknown Mall',
        lat: shop.lat || 0,
        lon: shop.lon || 0,
      },
    }));

    res.json({ success: true, shops: formatted });
  } catch (error) {
    console.error('❌ Shop search error:', error);
    // Send detailed error for debugging (remove in production)
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message,
    });
  }
};

// Update a mall shop (owner or admin)
exports.updateMallShop = async (req, res) => {
  const quotaRequestTime = new Date();
  let reservedProducts = 0;
  let quotaUserId;
  try {
    const { id } = req.params;
    const shop = await MallShop.findById(id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    // Allow owner or admin to update
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (String(shop.ownerId) !== String(userId) && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const updates = { ...(req.body || {}) };
    delete updates.ownerId;
    delete updates._id;
    delete updates.id;
    // Prevent changing mallId ownership via update unless admin
    if (!isAdmin) delete updates.mallId;

    if (updates.products !== undefined) {
      if (!Array.isArray(updates.products)) {
        return res.status(400).json({ success: false, message: 'Products must be provided as a list.' });
      }
      if (updates.products.some(product => !product || typeof product !== 'object' || Array.isArray(product))) {
        return res.status(400).json({ success: false, message: 'Each product must be an object.' });
      }

      quotaUserId = String(shop.ownerId);
      const addedProducts = countAddedProducts(shop.products || [], updates.products);
      if (addedProducts > 0) {
        const owner = await User.findById(quotaUserId).select('mallProductUploadLimitPerDay');
        const productLimit = Number.isSafeInteger(owner?.mallProductUploadLimitPerDay)
          ? owner.mallProductUploadLimitPerDay
          : DEFAULT_USER_PERMISSIONS.mallProductUploadLimitPerDay;
        const productsToday = await getDailyUsage(quotaUserId, 'mall_products', quotaRequestTime);
        if (productsToday + addedProducts > productLimit) {
          return res.status(403).json({
            success: false,
            message: `Daily product limit reached. Maximum ${productLimit} products per day.`,
            resetsAt: getNextDailyReset(quotaRequestTime).toISOString(),
          });
        }

        const reserved = await reserveDailyUsage(
          quotaUserId,
          'mall_products',
          addedProducts,
          productLimit,
          quotaRequestTime
        );
        if (!reserved) {
          return res.status(403).json({
            success: false,
            message: `Daily product limit reached. Maximum ${productLimit} products per day.`,
            resetsAt: getNextDailyReset(quotaRequestTime).toISOString(),
          });
        }
        reservedProducts = addedProducts;
      }

      updates.products = updates.products.map(product => ({
        ...product,
        imageVariants: Array.isArray(product.imageVariants) ? product.imageVariants : [],
        imageStorageKeys: storageService.collectStorageKeys
          ? storageService.collectStorageKeys(product.images || [])
          : (product.images || []).map(storageService.getStorageKeyFromUrl).filter(Boolean),
      }));
    }

    Object.keys(updates).forEach(key => {
      shop[key] = updates[key];
    });

    await shop.save();
    reservedProducts = 0;
    res.json({ success: true, shop });
  } catch (error) {
    if (reservedProducts) {
      await releaseDailyUsage(quotaUserId, 'mall_products', reservedProducts, quotaRequestTime)
        .catch(releaseError => console.error('[Permissions] Could not release failed mall product quota:', releaseError.code || releaseError.message));
    }
    console.error('Error updating mall shop:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Delete a mall shop (owner or admin)
exports.deleteMallShop = async (req, res) => {
  try {
    const { id } = req.params;
    const shop = await MallShop.findById(id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (String(shop.ownerId) !== String(userId) && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await deleteMallShopWithCleanup(id);

    res.json({ success: true, message: 'Mall shop and all related data deleted successfully' });
  } catch (error) {
    console.error('Error deleting mall shop:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getMyMallShops = async (req, res) => {
  try {
    const shops = await MallShop.find({ ownerId: req.user.id }).sort({ createdDate: -1 });
    res.json({ success: true, shops: shops.map(normalizeMallShopImageUrls) });
  } catch (error) {
    console.error('Error fetching my mall shops:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};