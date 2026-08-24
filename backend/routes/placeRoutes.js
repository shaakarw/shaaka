const express = require('express');
const router = express.Router();
const Place = require('../models/Place');
const User = require('../models/User');
const MallShop = require('../models/MallShop');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');
const { normalizeRwandaPhone, isValidRwandaPhone } = require('../utils/phoneNormalizer');
const { notifyUsers } = require('../services/notificationService');
const {
  deletePlaceWithCleanup,
  deleteCloudinaryAsset,
  parseCloudinaryPublicId,
  isCloudinaryUrl,
} = require('../utils/deletionCleanup');

// ---------- Custom multer config for single image ----------
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (mimetype && extname) return cb(null, true);
  cb(new Error('Only images are allowed'), false);
};
// Use a dedicated image upload middleware for the single-image upload endpoint
const imageUpload = multer({ storage, fileFilter }).single('image');

// Helper: upload buffer to Cloudinary
const uploadToCloudinary = (buffer, folder = 'places') => {
  return new Promise((resolve, reject) => {
    // Check if cloudinary is configured
    if (!cloudinary.config().cloud_name || cloudinary.config().cloud_name === 'dummy') {
      return reject(new Error('Cloudinary not configured'));
    }
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
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
    const result = await uploadToCloudinary(req.file.buffer, 'places');
    res.json({ success: true, url: result.secure_url });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: 'Image upload failed' });
  }
});


// POST add product to an existing place (authenticated, owner-only)
router.post('/:id/products', auth, async (req, res) => {
  try {
    const { name, price, description, images } = req.body;
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
    const maxProductsPerDay = (user && typeof user.placeProductUploadLimitPerDay === 'number') ? user.placeProductUploadLimitPerDay : 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const userPlaces = await Place.find({ userId, createdAt: { $gte: today, $lte: endOfDay } });
    const existingProductsToday = userPlaces.reduce((acc, p) => acc + ((p.products && p.products.length) || 0), 0);
    if (existingProductsToday >= maxProductsPerDay) {
      return res.status(403).json({ success: false, message: `You have reached your daily product limit. Maximum ${maxProductsPerDay} products per day.` });
    }

    const product = {
      name,
      price: Number(price),
      description: description || '',
      images: Array.isArray(images) ? images : (images ? [images] : []),
    };
    if (Number.isNaN(product.price)) {
      return res.status(400).json({ success: false, message: 'Invalid price' });
    }
    place.products.push(product);
    await place.save();
    res.status(201).json({ success: true, message: 'Product added', product });
  } catch (error) {
    console.error('POST /places/:id/products error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET all places (public)
router.get('/', async (req, res) => {
  try {
    const places = await Place.find().sort({ createdAt: -1 });
    res.json({ success: true, places });
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
    res.json({ success: true, place });
  } catch (error) {
    console.error('GET /place/:id error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST create a new place (authenticated) – expects JSON with image URLs
router.post('/', auth, async (req, res) => {
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
    const existingMallShop = await MallShop.findOne({ ownerId: userId });
    if (existingMallShop) {
      return res.status(403).json({ success: false, message: 'You already have a Shopping Mall Shop. You cannot add a Shop/Place.' });
    }

    // Enforce lifetime shop/place limit per user (default 1, admin override supported)
    const user = await User.findById(userId).select('shopUploadLimitLifetime postUploadLimitPerDay');
    const maxShopsLifetime = (user && typeof user.shopUploadLimitLifetime === 'number') ? user.shopUploadLimitLifetime : 1;
    const maxProductsPerDay = (user && typeof user.postUploadLimitPerDay === 'number') ? user.postUploadLimitPerDay : 1;

    const existingPlacesCount = await Place.countDocuments({ userId });
    if (existingPlacesCount >= maxShopsLifetime) {
      return res.status(403).json({ success: false, message: `You have reached your lifetime shop limit. Maximum ${maxShopsLifetime} shop/place.` });
    }

    // Count existing products created by this user today across places
    const today = new Date();
    today.setHours(0,0,0,0);
    const end = new Date(today);
    end.setHours(23,59,59,999);
    const existingPlaces = await Place.find({ userId, createdAt: { $gte: today, $lte: end } });
    const existingProductsCount = existingPlaces.reduce((acc, p) => acc + ((p.products && p.products.length) || 0), 0);
    const newProductsCount = (products && products.length) ? products.length : 0;
    if (existingProductsCount + newProductsCount > maxProductsPerDay) {
      return res.status(403).json({ success: false, message: `Daily product limit reached. Maximum ${maxProductsPerDay} products per day.` });
    }

    // Ensure every product has at most one image
    if (products && Array.isArray(products)) {
      for (const prod of products) {
        if (prod.images && prod.images.length > 1) {
          return res.status(400).json({ success: false, message: 'Each product can contain only one image.' });
        }
      }
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
      products: products || [],
      extras,
      contactButtons,
      socialLinks,
    });

    await newPlace.save();
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