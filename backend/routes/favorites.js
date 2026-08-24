const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getFavorites,
  togglePlaceFavorite,
  toggleShopFavorite,
} = require('../controllers/favorites');

router.use(auth);

router.get('/', getFavorites);
router.post('/places', togglePlaceFavorite);
router.delete('/places', togglePlaceFavorite);
router.post('/shops', toggleShopFavorite);
router.delete('/shops', toggleShopFavorite);

module.exports = router;