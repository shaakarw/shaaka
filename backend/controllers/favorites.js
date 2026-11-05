// controllers/favorites.js
const Favorite = require('../models/Favorite');
const MallShop = require('../models/MallShop');
const Shop = require('../models/Shop');

// Helper: get all place favorites as array of populated place objects
async function getFavoritesList(userId) {
  const favorites = await Favorite.find({ userId, type: 'place' })
    .populate('placeId')
    .lean();
  return favorites.map(f => f.placeId).filter(Boolean);
}

// Helper: get all shop favorites as array of populated shop objects
async function getShopFavorites(userId) {
  const favorites = await Favorite.find({ userId, type: 'shop' }).lean();
  const shops = await Promise.all(favorites.map(async (favorite) => {
    const shopId = favorite.shopId && typeof favorite.shopId === 'object'
      ? favorite.shopId._id || favorite.shopId.id
      : favorite.shopId;
    if (shopId == null) return null;
    const mallShop = await MallShop.findById(String(shopId));
    return mallShop || Shop.findById(String(shopId));
  }));
  return shops.filter(Boolean);
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

// POST / DELETE /api/favorites/shops – save or remove a shop favorite
exports.toggleShopFavorite = async (req, res) => {
  try {
    const { shopId } = req.body;
    const shopIdValue = shopId && typeof shopId === 'object'
      ? shopId._id || shopId.id
      : shopId;
    if (shopIdValue == null || String(shopIdValue).length === 0) {
      return res.status(400).json({ success: false, message: 'shopId required' });
    }
    const normalizedShopId = String(shopIdValue);

    const userId = req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const existing = await Favorite.findOne({ userId, shopId: normalizedShopId, type: 'shop' });
    if (req.method === 'DELETE' && existing) {
      await existing.deleteOne();
    } else if (req.method === 'POST' && !existing) {
      const favorite = new Favorite({ userId, shopId: normalizedShopId, type: 'shop' });
      await favorite.save();
    }

    const updated = await getShopFavorites(userId);
    res.json({ success: true, favoriteShops: updated });
  } catch (error) {
    console.error('Toggle shop favorite error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};