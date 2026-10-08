const mongoose = require('mongoose');

const statusSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true // ensures one status per user (overwrites on update)
  },
  status: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100 // adjust as needed
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Status', statusSchema);