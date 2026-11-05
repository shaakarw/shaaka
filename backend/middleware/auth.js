// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const reject = (res, status, message, reason) =>
  res.status(status).json({ success: false, message, reason });

module.exports = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return reject(res, 401, 'No token provided', 'no_token');

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
  } catch (error) {
    return reject(res, 401, 'Token is malformed or has an invalid signature', 'invalid_token');
  }

  const userId = decoded.id || decoded.userId || decoded._id;
  if (!userId) return reject(res, 401, 'No user ID in token', 'no_user_id');

  let user;
  try {
    user = await User.findById(userId).select('-password');
  } catch (error) {
    console.error('Auth user lookup failed:', error);
    return reject(res, 503, 'Authentication service is temporarily unavailable', 'auth_unavailable');
  }

  if (!user) return reject(res, 401, 'User not found', 'user_not_found');
  if (user.blocked) {
    return reject(res, 403, 'Your account has been blocked. Please contact support.', 'user_blocked');
  }

  const currentSessionId = user.currentSession?.sessionId;
  const tokenSessionId = decoded.sessionId;
  const tokenVersion = Number(decoded.tokenVersion ?? 0);
  const currentTokenVersion = Number(user.tokenVersion ?? 0);
  if (
    tokenVersion !== currentTokenVersion
    || (tokenSessionId && (!currentSessionId || tokenSessionId !== currentSessionId))
  ) {
    if (currentSessionId && tokenSessionId && tokenSessionId !== currentSessionId) {
      return reject(res, 401, 'signed_in_elsewhere', 'session_invalidated');
    }
    return reject(res, 401, 'session_ended', 'session_ended');
  }

  const now = new Date();
  const lastActiveAt = user.lastActiveAt ? new Date(user.lastActiveAt) : null;
  if (!lastActiveAt || (now.getTime() - lastActiveAt.getTime()) > 5 * 60 * 1000) {
    try {
      user.lastActiveAt = now;
      await user.save();
    } catch (error) {
      console.error('Could not update authenticated user activity:', error);
      return reject(res, 503, 'Authentication service is temporarily unavailable', 'auth_unavailable');
    }
  }

  req.user = user;
  req.authToken = decoded;
  next();
};
