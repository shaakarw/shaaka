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
  // ✅ NEW: Products array
  products: [
   {
     name: { type: String, required: true },
     price: { type: Number, required: true },
     description: { type: String, default: '' },
     images: [String], // URLs after upload
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