// routes/mallShops.js
const express = require('express');
const router = express.Router();
const mallShopController = require('../controllers/mallShopController');
const User = require('../models/User');
const auth = require('../middleware/auth');

// ✅ Search – public (no auth required)
router.get('/search', mallShopController.searchMallShops);

// All other routes require authentication
router.use(auth);

// Create a new shop inside a mall
router.post('/', mallShopController.createMallShop);


// Get all shops for a specific mall (query param: mallId)
router.get('/', mallShopController.getMallShopsByMall);

// Get a single shop by ID
router.get('/:id', mallShopController.getMallShopById);

// Update a shop
router.put('/:id', mallShopController.updateMallShop);

// Delete a shop
router.delete('/:id', mallShopController.deleteMallShop);

module.exports = router;