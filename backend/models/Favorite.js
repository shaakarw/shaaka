const mongoose = require('mongoose');

const FavoriteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  placeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Place',
    default: null,
  },
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    default: null,
  },
  type: {
    type: String,
    enum: ['place', 'shop'],
    required: true,
  },
}, {
  timestamps: true,
  indexes: [
    { unique: true, fields: ['userId', 'placeId'], partialFilterExpression: { placeId: { $ne: null } } },
    { unique: true, fields: ['userId', 'shopId'], partialFilterExpression: { shopId: { $ne: null } } },
  ],
});

FavoriteSchema.index({ userId: 1, type: 1 });

module.exports = mongoose.model('Favorite', FavoriteSchema);