// middleware/auth.js
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// ✅ Get the User model from Mongoose to avoid circular dependency
const User = mongoose.model('User');

module.exports = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided',
      reason: 'no_token',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔑 Decoded token payload:', decoded);

    // Find user by ID (try common field names)
    let userId = decoded.id || decoded.userId || decoded._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'No user ID in token',
        reason: 'no_user_id',
      });
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        reason: 'user_not_found',
      });
    }

    // Blocked user check
    if (user.blocked) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked. Please contact support.',
        reason: 'user_blocked',
      });
    }

    const now = new Date();
    const lastActiveAt = user.lastActiveAt ? new Date(user.lastActiveAt) : null;
    const throttleWindowMs = 5 * 60 * 1000;
    if (!lastActiveAt || (now.getTime() - lastActiveAt.getTime()) > throttleWindowMs) {
      user.lastActiveAt = now;
      await user.save();
    }

    // ✅ All checks passed – attach user to request
    req.user = user;
    next();
  } catch (err) {
    console.error('❌ Auth error:', err.message);
    return res.status(401).json({
      success: false,
      message: 'Token is not valid (expired or malformed)',
      reason: 'jwt_invalid',
    });
  }
};