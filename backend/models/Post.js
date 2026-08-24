const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  userPhone: { type: String, required: true }, // ✅ remains required
  userAvatar: { type: String, default: '' },
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
  videoUrl: { type: String, default: '' },
  videoDuration: { type: Number, default: 0 },
  amount: { type: String },
  ownerPhone: { type: String },
  status: { type: String, enum: ['active', 'stopped'], default: 'active' },
  isReported: { type: Boolean, default: false },
}, { timestamps: true });

postSchema.pre('save', async function() {
  this.amount = `RWF ${this.price.toLocaleString()}`;
  this.ownerPhone = this.userPhone;
});

module.exports = mongoose.model('Post', postSchema);