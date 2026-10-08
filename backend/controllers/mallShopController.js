// controllers/mallShopController.js
const MallShop = require('../models/MallShop');
const User = require('../models/User');
const Place = require('../models/Place');
const { deleteMallShopWithCleanup } = require('../utils/deletionCleanup');
const { normalizeRwandaPhone, isValidRwandaPhone } = require('../utils/phoneNormalizer');
const { notifyUsers } = require('../services/notificationService');
const storageService = require('../services/storage/storageService');

// Create a new shop inside a mall
exports.createMallShop = async (req, res) => {
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
      products,
      lat,
      lon,
    } = req.body;

    const normalizedProducts = (products || []).map(product => ({
      ...product,
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

    if (!isValidRwandaPhone(phone)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid Rwanda phone number (e.g. 0781234567)' });
    }
    if (whatsapp && !isValidRwandaPhone(whatsapp)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid WhatsApp number or leave it empty' });
    }

    const normalizedPhone = normalizeRwandaPhone(phone);
    const normalizedWhatsApp = whatsapp ? normalizeRwandaPhone(whatsapp) : '';

    // One-type-only rule: user cannot have both a normal place/shop and a shopping mall shop
    const userId = req.user.id;
    const existingPlace = await Place.findOne({ userId });
    if (existingPlace) {
      return res.status(403).json({ success: false, message: 'You already have a Shop/Place. You cannot add a Shopping Mall Shop.' });
    }

    // Enforce lifetime mall shop limit per user (default 1, admin override supported)
    const user = await User.findById(userId).select('mallShopUploadLimitLifetime mallProductUploadLimitPerDay');
    const maxMallShopsLifetime = (user && typeof user.mallShopUploadLimitLifetime === 'number') ? user.mallShopUploadLimitLifetime : 1;
    const maxProductsPerDay = (user && typeof user.mallProductUploadLimitPerDay === 'number') ? user.mallProductUploadLimitPerDay : 1;

    const existingMallShopsCount = await MallShop.countDocuments({ ownerId: userId });
    if (existingMallShopsCount >= maxMallShopsLifetime) {
      return res.status(403).json({ success: false, message: `You have reached your lifetime shopping mall shop limit. Maximum ${maxMallShopsLifetime} shop.` });
    }

    // Ensure each product has at most one image and enforce daily product limit
    const today = new Date(); today.setHours(0,0,0,0);
    const end = new Date(today); end.setHours(23,59,59,999);
    if (products && Array.isArray(products)) {
      const existingShops = await MallShop.find({ ownerId: userId, createdDate: { $gte: today, $lte: end } });
      const existingProductsCount = existingShops.reduce((count, shop) => count + ((shop.products && shop.products.length) || 0), 0);
      const newProductsCount = products.length;
      if (existingProductsCount + newProductsCount > maxProductsPerDay) {
        return res.status(403).json({ success: false, message: `Daily product limit reached. Maximum ${maxProductsPerDay} products per day.` });
      }
      for (const prod of products) {
        if (prod.images && prod.images.length > 1) {
          return res.status(400).json({ success: false, message: 'Each product can contain only one image.' });
        }
      }
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
      frontImageStorageKey,
      storageProvider: 'b2',
      products: normalizedProducts,
      lat,
      lon,
      createdDate: new Date(),
    });

    await shop.save();
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
    res.json({ success: true, shops });
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
    res.json({ success: true, shop });
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
      ...shop,
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

    const updates = req.body || {};
    // Prevent changing mallId ownership via update unless admin
    if (!isAdmin) delete updates.mallId;

    Object.keys(updates).forEach(key => {
      shop[key] = updates[key];
    });

    await shop.save();
    res.json({ success: true, shop });
  } catch (error) {
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
    res.json({ success: true, shops });
  } catch (error) {
    console.error('Error fetching my mall shops:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};