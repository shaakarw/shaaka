const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  userPhone: { type: String, required: true }, // ✅ remains required
  userAvatar: { type: String, default: '' },
  userAvatarVariants: [{
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
  category: {
    type: String,
    enum: ['house', 'land', 'commercial', 'other'],
    required: true,
  },
  productName: { type: String, default: '' },
  bedrooms: { type: Number, default: null },
  bathrooms: { type: Number, default: null },
  size: { type: Number, default: null },
  description: { type: String, required: true },
  location: { type: String, required: true },
  price: { type: Number, required: true },
  priceNegotiable: { type: Boolean, default: false },
  contactNumbers: [{ type: String }],
  houseImages: [{ type: String }],
  houseImageStorageKeys: [{ type: String }],
  houseImageVariants: [{
    originalUrl: { type: String, required: true },
    originalStorageKey: { type: String, default: '' },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    variants: {
      tiny: { url: String, storageKey: String, width: Number, height: Number, fileSize: Number },
      small: { url: String, storageKey: String, width: Number, height: Number, fileSize: Number },
      medium: { url: String, storageKey: String, width: Number, height: Number, fileSize: Number },
      large: { url: String, storageKey: String, width: Number, height: Number, fileSize: Number },
    },
  }],
  storageProvider: { type: String, default: '' },
  videoUrl: { type: String, default: '' },
  videoHlsUrl: { type: String, default: '' },
  videoId: { type: String, default: '' },
  videoStorageKey: { type: String, default: '' },
  videoDuration: { type: Number, default: 0 },
  videoThumbnail: { type: String, default: '' },
  videoThumbnailStorageKey: { type: String, default: '' },
  videoThumbnailStatus: { type: String, enum: ['', 'completed'], default: '' },
  videoLink: { type: String, default: '' },
  amount: { type: String },
  ownerPhone: { type: String },
  featured: { type: Boolean, default: false },
  trending: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'stopped'], default: 'active' },
  isReported: { type: Boolean, default: false },
}, { timestamps: true });

postSchema.index({ trending: -1, featured: -1, createdAt: -1 });
postSchema.index({ status: 1, createdAt: -1, _id: -1 });
postSchema.index({ createdAt: -1, _id: -1 });

postSchema.pre('save', async function() {
  this.amount = `RWF ${this.price.toLocaleString()}`;
  this.ownerPhone = this.userPhone;
});

module.exports = mongoose.model('Post', postSchema);