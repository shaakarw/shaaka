const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    match: /^07[0-9]{8}$/,
  },
 idNumber: {
  type: String,
  required: true,
  unique: true,
  validate: {
    validator: function(v) {
      return /^\d{4,}$/.test(v);   // at least 4 digits
    },
    message: 'Recovery number must be at least 4 digits',
  },
},
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  passwordHistory: {
    type: [String],
    default: [],
  },
  avatar: { 
    type: String, 
    default: '' 
  },
  stories: [
    {
      image: String,
      createdAt: { type: Date, default: Date.now },
      views: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          viewedAt: { type: Date, default: Date.now }
        }
      ]
    }
  ],
  location: { 
    type: String, 
    default: 'Kigali, Rwanda' 
  },
  bio: { 
    type: String, 
    default: '' 
  },
  name: { 
    type: String, 
    default: '' 
  },
  email: { 
    type: String, 
    default: '' 
  },
  socialLinks: {
    type: [String],
    default: [],
    validate: {
      validator: function(links) {
        return Array.isArray(links) && links.length <= 3;
      },
      message: 'A user can have at most 3 social media links',
    },
  notificationPreferences: {
    newPosts: { type: Boolean, default: true },
    newShops: { type: Boolean, default: true },
    newPlaces: { type: Boolean, default: true },
    newShoppingMalls: { type: Boolean, default: true },
    newMallShops: { type: Boolean, default: true },
    mapPlacesAdded: { type: Boolean, default: true },
    passwordChanged: { type: Boolean, default: true },
    nameChanged: { type: Boolean, default: true },
  },
  },
  isOnline: { 
    type: Boolean, 
    default: false 
  },
  lastActiveAt: {
    type: Date,
    default: Date.now,
  },
  accountDeletionStatus: {
    type: String,
    enum: ['active', 'scheduled', 'deleted'],
    default: 'active',
  },
  accountDeletionScheduledAt: {
    type: Date,
    default: null,
  },
  accountDeletionNotifiedAt: {
    type: Date,
    default: null,
  },
  lastSeen: { 
    type: Date, 
    default: Date.now 
  },
  tokenVersion: {
    type: Number,
    default: 0,
  },
  currentSession: {
    sessionId: { type: String, default: '' },
    deviceId: { type: String, default: '' },
    socketId: { type: String, default: '' },
    createdAt: Date,
    lastSeen: Date,
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  savedPosts: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Post' 
  }],
  blocked: { 
    type: Boolean, 
    default: false 
  },

  // ========== DAILY MESSAGE USAGE FIELDS ==========
  dailyMessagesUsed: {
    type: Number,
    default: 0,
  },
  messagesLastReset: {
    type: Date,
    default: Date.now,
  },

  // ========== ADMIN OVERRIDES (per-user) ==========
  // Admin can override these per-user limits/permissions
  postUploadLimitPerDay: {
    type: Number,
    default: 1,
  },
  shopUploadLimitLifetime: {
    type: Number,
    default: 1,
  },
  mallShopUploadLimitLifetime: {
    type: Number,
    default: 1,
  },
  placeProductUploadLimitPerDay: {
    type: Number,
    default: 1,
  },
  mallProductUploadLimitPerDay: {
    type: Number,
    default: 1,
  },

  // ========== MESSAGE LIMITS ==========
  imagesPerMessage: {
    type: Number,
    default: 10,
  },
  imagesRetentionDays: {
    type: Number,
    default: 5,
  },
  messagesRetentionDays: {
    type: Number,
    default: 30,
  },

  planStartDate: {
    type: Date,
    default: Date.now,
  },

  // ========== NEW SUBSCRIPTION FIELDS ==========
  plan: {
    type: String,
    enum: ['free', 'standard', 'premium', 'business', 'enterprise'],
    default: 'free',
  },
  planName: {
    type: String,
    default: 'Free',
  },
  planExpiry: {
    type: Date,
    default: null, // null for free plan (never expires)
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'expired', 'pending'],
    default: 'active',
  },
  paymentHistory: [
    {
      plan: String,
      planName: String,
      amount: Number,
      currency: { type: String, default: 'RWF' },
      transactionId: String,
      paymentMethod: { type: String, default: 'MTN MoMo' },
      paymentDate: { type: Date, default: Date.now },
      expiryDate: Date,
      status: { 
        type: String, 
        enum: ['success', 'pending', 'failed'], 
        default: 'success' 
      },
    },
  ],
}, { 
  timestamps: true 
});

// Hash password before saving - FIXED: async function (no next)
UserSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(this.password, salt);
    this.password = hashedPassword;

    const history = (this.passwordHistory || []).filter(Boolean);
    const nextHistory = [hashedPassword, ...history].filter((value, index, self) => self.indexOf(value) === index).slice(0, 5);
    this.passwordHistory = nextHistory;
  } catch (error) {
    console.error('Password hash error:', error);
    throw error;
  }
});

// Method to compare password
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to get user profile without sensitive data
UserSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.resetPasswordToken;
  delete userObject.resetPasswordExpire;
  return userObject;
};

module.exports = mongoose.model('User', UserSchema);