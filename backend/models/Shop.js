const mongoose = require('mongoose');
const shopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, default: '' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['active', 'stopped'], default: 'active' },
  type: { type: String, default: 'shop' },
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('Shop', shopSchema);