const express = require('express');
const router = express.Router();
const Place = require('../models/Place');
const User = require('../models/User');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const storageService = require('../services/storage/storageService');
const { uploadImageWithVariants } = require('../services/imageUpload');
const { resolveStoredImageUrl } = require('../utils/storedImageUrl');
const { normalizeRwandaPhone, isValidRwandaPhone } = require('../utils/phoneNormalizer');
const { notifyUsers } = require('../services/notificationService');
const { deletePlaceWithCleanup } = require('../utils/deletionCleanup');
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

// ---------- Custom multer config for single image ----------
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  const extname = path.extname(file.originalname).length > 0;
  const mimetype = (file.mimetype || '').toLowerCase().startsWith('image/');
  if (mimetype && extname) return cb(null, true);
  cb(new Error('Only supported image files are allowed'), false);
};
// Use a dedicated image upload middleware for the single-image upload endpoint
const imageUpload = multer({ storage, fileFilter }).single('image');

const normalizePlaceImageUrls = place => {
  const result = typeof place.toObject === 'function' ? place.toObject() : { ...place };
  result.images = { ...result.images };
  for (const field of ['streetImage', 'street', 'doorImage']) {
    result.images[field] = resolveStoredImageUrl(
      result.images[field],
      result.imageStorageKeys?.[field],
      storageService
    );
  }
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

// ----- POST /api/places/upload – single image (used by frontend) -----
router.post('/upload', auth, imageUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image provided' });
    }
    const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
    if (!req.file.buffer || req.file.buffer.length > MAX_IMAGE_BYTES) {
      return res.status(400).json({ success: false, message: 'Image exceeds 3 MB size limit' });
    }
    const uploaded = await uploadImageWithVariants({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      folder: `places/${req.user.id}/images`,
      maxBytes: MAX_IMAGE_BYTES,
      origin: storageService.getRequestOrigin(req),
    });
    res.json({
      success: true,
      url: uploaded.originalUrl,
      ...uploaded.original,
      imageVariants: uploaded.imageVariants,
    });
  } catch (error) {
    console.error('Place image upload error:', error.code || error.message || 'Unknown error');
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Image upload failed' });
  }
});


// POST add product to an existing place (authenticated, owner-only)
router.post('/:id/products', auth, async (req, res) => {
  const quotaRequestTime = new Date();
  let reservedProducts = 0;
  try {
    const { name, price, description, images, imageVariants } = req.body;
    const place = await Place.findById(req.params.id);
    if (!place) {
      return res.status(404).json({ success: false, message: 'Place not found' });
    }
    if (place.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (!name || !price) {
      return res.status(400).json({ success: false, message: 'Product name and price are required' });
    }

    // Enforce per-user daily product limit for places (default 1, admin override supported)
    const userId = req.user.id;
    const user = await User.findById(userId).select('placeProductUploadLimitPerDay');
    const maxProductsPerDay = Number.isSafeInteger(user?.placeProductUploadLimitPerDay)
      ? user.placeProductUploadLimitPerDay
      : DEFAULT_USER_PERMISSIONS.placeProductUploadLimitPerDay;
    const product = {
      name,
      price: Number(price),
      description: description || '',
      images: Array.isArray(images) ? images : (images ? [images] : []),
      imageVariants: Array.isArray(imageVariants) ? imageVariants : [],
    };
    if (Number.isNaN(product.price)) {
      return res.status(400).json({ success: false, message: 'Invalid price' });
    }
    const productsToday = await getDailyUsage(userId, 'place_products', quotaRequestTime);
    if (productsToday >= maxProductsPerDay) {
      return res.status(403).json({
        success: false,
        message: `You have reached your daily product limit. Maximum ${maxProductsPerDay} products per day.`,
        resetsAt: getNextDailyReset(quotaRequestTime).toISOString(),
      });
    }
    reservedProducts = await reserveDailyUsage(userId, 'place_products', 1, maxProductsPerDay, quotaRequestTime)
      ? 1
      : 0;
    if (!reservedProducts) {
      return res.status(403).json({
        success: false,
        message: `You have reached your daily product limit. Maximum ${maxProductsPerDay} products per day.`,
        resetsAt: getNextDailyReset(quotaRequestTime).toISOString(),
      });
    }
    place.products.push(product);
    await place.save();
    reservedProducts = 0;
    res.status(201).json({
      success: true,
      message: 'Product added',
      product: place.products[place.products.length - 1],
      place,
    });
  } catch (error) {
    if (reservedProducts) {
      await releaseDailyUsage(req.user.id, 'place_products', reservedProducts, quotaRequestTime)
        .catch(releaseError => console.error('[Permissions] Could not release failed place product quota:', releaseError.code || releaseError.message));
    }
    console.error('POST /places/:id/products error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET all places (public)
router.get('/', async (req, res) => {
  try {
    const places = await Place.find().sort({ createdAt: -1 });
    res.json({ success: true, places: places.map(normalizePlaceImageUrls) });
  } catch (error) {
    console.error('GET /places error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET a single place
router.get('/:id', async (req, res) => {
  try {
    const place = await Place.findById(req.params.id);
    if (!place) {
      return res.status(404).json({ success: false, message: 'Place not found' });
    }
    res.json({ success: true, place: normalizePlaceImageUrls(place) });
  } catch (error) {
    console.error('GET /place/:id error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST create a new place (authenticated) – expects JSON with image URLs
router.post('/', auth, async (req, res) => {
  const quotaRequestTime = new Date();
  let reservedShopLifetime = false;
  let reservedPlaceProducts = 0;
  try {
    const {
      name,
      description,
      category,
      location,
      address,
      contact,
      openingTime,
      closingTime,
      streetName,
      buildingNumber,
      images,
      products,
      imageVariants,
      extras,
      contactButtons,
      socialLinks,
    } = req.body;

    if (!name || !category || !location || !location.latitude || !location.longitude) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, category, location',
      });
    }

    if ((category === 'shoppingmall' || category === 'shopping_mall') && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can add shopping malls',
      });
    }

    const contactPhone = (req.body.contact && req.body.contact.phone) || '';
    if (!contactPhone || !contactPhone.trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }
    if (!isValidRwandaPhone(contactPhone)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid Rwanda phone number (e.g. 0781234567)' });
    }

    const contactWhatsApp = (req.body.contact && req.body.contact.whatsapp) || '';
    if (contactWhatsApp && contactWhatsApp.trim() && !isValidRwandaPhone(contactWhatsApp)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid WhatsApp number or leave it empty' });
    }

    // One-type-only rule: user cannot have both a normal place/shop and a shopping mall shop
    const userId = req.user.id;
    const existingMallShopCount = await getLifetimeUsage(userId, 'mall_shops');
    if (existingMallShopCount > 0) {
      return res.status(403).json({ success: false, message: 'You already have a Shopping Mall Shop. You cannot add a Shop/Place.' });
    }

    // Enforce lifetime shop/place limit per user (default 1, admin override supported)
    const user = await User.findById(userId).select('shopUploadLimitLifetime placeProductUploadLimitPerDay');
    const maxShopsLifetime = Number.isSafeInteger(user?.shopUploadLimitLifetime)
      ? user.shopUploadLimitLifetime
      : DEFAULT_USER_PERMISSIONS.shopUploadLimitLifetime;
    const maxProductsPerDay = Number.isSafeInteger(user?.placeProductUploadLimitPerDay)
      ? user.placeProductUploadLimitPerDay
      : DEFAULT_USER_PERMISSIONS.placeProductUploadLimitPerDay;
    const existingPlacesCount = await getLifetimeUsage(userId, 'shops_places');
    if (category !== 'shoppingmall' && category !== 'shopping_mall' && existingPlacesCount >= maxShopsLifetime) {
      return res.status(403).json({ success: false, message: `You have reached your lifetime shop limit. Maximum ${maxShopsLifetime} shop/place.` });
    }

    // Ensure every product has at most one image
    if (products && Array.isArray(products)) {
      for (const prod of products) {
        if (prod.images && prod.images.length > 1) {
          return res.status(400).json({ success: false, message: 'Each product can contain only one image.' });
        }
      }
    }

    const isNormalPlace = category !== 'shoppingmall' && category !== 'shopping_mall';
    const newProductsCount = isNormalPlace && Array.isArray(products) ? products.length : 0;
    if (isNormalPlace) {
      reservedShopLifetime = await reserveLifetimeUsage(userId, 'shops_places', 1, maxShopsLifetime);
      if (!reservedShopLifetime) {
        return res.status(403).json({ success: false, message: `You have reached your lifetime shop limit. Maximum ${maxShopsLifetime} shop/place.` });
      }
    }
    if (newProductsCount > 0) {
      const productsToday = await getDailyUsage(userId, 'place_products', quotaRequestTime);
      if (productsToday + newProductsCount > maxProductsPerDay) {
        if (reservedShopLifetime) {
          await releaseLifetimeUsage(userId, 'shops_places', 1);
          reservedShopLifetime = false;
        }
        return res.status(403).json({
          success: false,
          message: `Daily product limit reached. Maximum ${maxProductsPerDay} products per day.`,
          resetsAt: getNextDailyReset(quotaRequestTime).toISOString(),
        });
      }
      const productsReserved = await reserveDailyUsage(userId, 'place_products', newProductsCount, maxProductsPerDay, quotaRequestTime);
      if (!productsReserved) {
        if (reservedShopLifetime) {
          await releaseLifetimeUsage(userId, 'shops_places', 1);
          reservedShopLifetime = false;
        }
        return res.status(403).json({
          success: false,
          message: `Daily product limit reached. Maximum ${maxProductsPerDay} products per day.`,
          resetsAt: getNextDailyReset(quotaRequestTime).toISOString(),
        });
      }
      reservedPlaceProducts = newProductsCount;
    }

    const newPlace = new Place({
      userId: req.user.id,
      name,
      description,
      category,
      location,
      address,
      contact: {
        phone: contact.phone ? normalizeRwandaPhone(contact.phone) : '',
        whatsapp: contact.whatsapp ? normalizeRwandaPhone(contact.whatsapp) : '',
        email: contact.email || '',
        website: contact.website || '',
      },
      openingTime,
      closingTime,
      streetName,
      buildingNumber,
      images: images || {},
      imageVariants: Array.isArray(imageVariants) ? imageVariants : [],
      imageStorageKeys: Object.fromEntries(Object.entries(images || {}).map(([name, url]) => [
        name,
        storageService.getStorageKeyFromUrl(url) || '',
      ])),
      storageProvider: 'b2',
      products: (products || []).map(product => ({
        ...product,
        imageVariants: Array.isArray(product.imageVariants) ? product.imageVariants : [],
        imageStorageKeys: storageService.collectStorageKeys
          ? storageService.collectStorageKeys(product.images || [])
          : (product.images || []).map(storageService.getStorageKeyFromUrl).filter(Boolean),
      })),
      extras,
      contactButtons,
      socialLinks,
    });

    await newPlace.save();
    reservedShopLifetime = false;
    reservedPlaceProducts = 0;
    const notificationType = category === 'shoppingmall' ? 'NEW_SHOPPING_MALL' : category === 'shop' ? 'NEW_SHOP' : 'NEW_PLACE';
    try {
      await notifyUsers({
        type: notificationType,
        title: newPlace.name,
        message: notificationType === 'NEW_SHOPPING_MALL' ? 'New shopping mall added' : notificationType === 'NEW_SHOP' ? 'New shop added' : 'New place added',
        image: newPlace.images?.streetImage || newPlace.images?.doorImage || '',
        placeId: newPlace._id,
        shopId: category === 'shop' ? newPlace._id : undefined,
        shoppingMallId: category === 'shoppingmall' ? newPlace._id : undefined,
        actorId: req.user.id,
      });
    } catch (notificationError) {
      console.error('New place notification error:', notificationError);
    }
    res.status(201).json({ success: true, place: newPlace });
  } catch (error) {
    const releases = [];
    if (reservedShopLifetime) releases.push(releaseLifetimeUsage(req.user.id, 'shops_places', 1));
    if (reservedPlaceProducts) {
      releases.push(releaseDailyUsage(req.user.id, 'place_products', reservedPlaceProducts, quotaRequestTime));
    }
    await Promise.all(releases.map(release => release.catch(releaseError => {
      console.error('[Permissions] Could not release failed place creation quota:', releaseError.code || releaseError.message);
    })));
    console.error('POST /places error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT update a place (authenticated)
router.put('/:id', auth, async (req, res) => {
  try {
    const place = await Place.findById(req.params.id);
    if (!place) {
      return res.status(404).json({ success: false, message: 'Place not found' });
    }
    if (place.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const updates = req.body;
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) place[key] = updates[key];
    });
    await place.save();
    res.json({ success: true, place });
  } catch (error) {
    console.error('PUT /places/:id error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE a place
router.delete('/:id', auth, async (req, res) => {
  try {
    const place = await Place.findById(req.params.id);
    if (!place) {
      return res.status(404).json({ success: false, message: 'Place not found' });
    }
    if (place.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await deletePlaceWithCleanup(req.params.id);

    res.json({ success: true, message: 'Place and all related data deleted successfully' });
  } catch (error) {
    console.error('DELETE /places/:id error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;