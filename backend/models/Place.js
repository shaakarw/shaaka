const mongoose = require('mongoose');

const PlaceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: { type: String, required: true },
  description: { type: String, maxlength: 500 },
  category: { type: String, required: true },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  address: {
    country: String,
    province: String,
    district: String,
    sector: String,
    cell: String,
    village: String,
    street: String,
    full: String,
  },
  contact: {
    phone: String,
    whatsapp: String,
    email: String,
    website: String,
  },
  openingTime: String,
  closingTime: String,
  streetName: String,
  buildingNumber: String,
  images: {
    // Street media: either streetImage or streetVideo (admin may control video permission per user)
    streetImage: String,
   street: String,
   streetVideo: String,
   // Door/media for shopping mall doors — kept here if needed
   doorImage: String,
   doorVideo: String,
  },
  imageStorageKeys: {
    streetImage: { type: String, default: '' },
    street: { type: String, default: '' },
    streetVideo: { type: String, default: '' },
    doorImage: { type: String, default: '' },
    doorVideo: { type: String, default: '' },
  },
  imageVariants: [{
    originalUrl: String,
    originalStorageKey: String,
    width: Number,
    height: Number,
    variants: {
      tiny: { url: String, storageKey: String, width: Number, height: Number, fileSize: Number },
      small: { url: String, storageKey: String, width: Number, height: Number, fileSize: Number },
      medium: { url: String, storageKey: String, width: Number, height: Number, fileSize: Number },
      large: { url: String, storageKey: String, width: Number, height: Number, fileSize: Number },
    },
  }],
  storageProvider: { type: String, default: '' },
  // ✅ NEW: Products array
  products: [
   {
     name: { type: String, required: true },
     price: { type: Number, required: true },
     description: { type: String, default: '' },
     images: [String], // URLs after upload
    imageStorageKeys: [{ type: String }],
    imageVariants: [{
      originalUrl: String,
      originalStorageKey: String,
      width: Number,
      height: Number,
      variants: {
        tiny: { url: String, storageKey: String, width: Number, height: Number, fileSize: Number },
        small: { url: String, storageKey: String, width: Number, height: Number, fileSize: Number },
        medium: { url: String, storageKey: String, width: Number, height: Number, fileSize: Number },
        large: { url: String, storageKey: String, width: Number, height: Number, fileSize: Number },
      },
    }],
   },
  ],
  extras: {
    wheelchair: Boolean,
    parking: Boolean,
    wifi: Boolean,
    delivery: Boolean,
    takeaway: Boolean,
    reservations: Boolean,
    outdoor: Boolean,
    petfriendly: Boolean,
  },
  contactButtons: {
    call: Boolean,
    whatsapp: Boolean,
    website: Boolean,
    email: Boolean,
  },
  socialLinks: {
    instagram: String,
    facebook: String,
    tiktok: String,
    x: String,
    youtube: String,
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Place', PlaceSchema);