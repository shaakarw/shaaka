const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: [
      'NEW_POST',
      'NEW_SHOP',
      'NEW_PLACE',
      'NEW_SHOPPING_MALL',
      'NEW_MALL_SHOP',
      'MAP_PLACE_ADDED',
      'PASSWORD_CHANGED',
      'NAME_CHANGED',
      'message',
    ],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  image: { type: String, default: '' },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Place' },
  placeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Place' },
  shoppingMallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Place' },
  mallShopId: { type: mongoose.Schema.Types.ObjectId, ref: 'MallShop' },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 259200 },
});

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
