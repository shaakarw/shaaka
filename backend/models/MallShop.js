const mongoose = require('mongoose');
const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  description: String,
  images: [String],
  imageStorageKeys: [{ type: String }],
});
const mallShopSchema = new mongoose.Schema({
  mallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Place', required: true },
  mallName: String,
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: String,
  description: String,
  category: String,
  shopNumber: String,
  floorNumber: String,
  address: String,
  phone: String,
  whatsapp: String,
  email: String,
  website: String,
  openingTime: String,
  closingTime: String,
  // Front media image for mall shop
  images: { frontImage: String },
  frontImageStorageKey: { type: String, default: '' },
  storageProvider: { type: String, default: '' },
  products: [productSchema],
  lat: Number,
  lon: Number,
  createdDate: { type: Date, default: Date.now },
});
module.exports = mongoose.model('MallShop', mallShopSchema);