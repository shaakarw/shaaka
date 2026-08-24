// controllers/favorites.js
const Favorite = require('../models/Favorite');
const User = require('../models/User'); // kept for reference (optional)

// Helper: get all place favorites as array of populated place objects
async function getFavoritesList(userId) {
  const favorites = await Favorite.find({ userId, type: 'place' })
    .populate('placeId')
    .lean();
  return favorites.map(f => f.placeId).filter(Boolean);
}

// Helper: get all shop favorites as array of populated shop objects
async function getShopFavorites(userId) {
  const favorites = await Favorite.find({ userId, type: 'shop' })
    .populate('shopId')
    .lean();
  return favorites.map(f => f.shopId).filter(Boolean);
}

// GET /api/favorites – get all favorites (places + shops)
exports.getFavorites = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const places = await getFavoritesList(userId);
    const shops = await getShopFavorites(userId);

    res.json({
      success: true,
      favorites: places,
      favoriteShops: shops,
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST / DELETE /api/favorites/places – toggle a place favorite
exports.togglePlaceFavorite = async (req, res) => {
  try {
    const { placeId } = req.body;
    if (!placeId) {
      return res.status(400).json({ success: false, message: 'placeId required' });
    }

    const userId = req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const existing = await Favorite.findOne({ userId, placeId, type: 'place' });
    if (existing) {
      // Remove
      await existing.deleteOne();
    } else {
      // Add
      const favorite = new Favorite({ userId, placeId, type: 'place' });
      await favorite.save();
    }

    const updated = await getFavoritesList(userId);
    res.json({ success: true, favorites: updated });
  } catch (error) {
    console.error('Toggle place favorite error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST / DELETE /api/favorites/shops – toggle a shop favorite
exports.toggleShopFavorite = async (req, res) => {
  try {
    const { shopId } = req.body;
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'shopId required' });
    }

    const userId = req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const existing = await Favorite.findOne({ userId, shopId, type: 'shop' });
    if (existing) {
      await existing.deleteOne();
    } else {
      const favorite = new Favorite({ userId, shopId, type: 'shop' });
      await favorite.save();
    }

    const updated = await getShopFavorites(userId);
    res.json({ success: true, favoriteShops: updated });
  } catch (error) {
    console.error('Toggle shop favorite error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};