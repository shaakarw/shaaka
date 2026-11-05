// middleware/adminAuth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.adminAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token', reason: 'invalid_token' });
  }

  let user;
  try {
    user = await User.findById(decoded.userId || decoded.id);
  } catch (error) {
    console.error('Admin auth user lookup failed:', error);
    return res.status(503).json({ success: false, message: 'Authentication service is temporarily unavailable', reason: 'auth_unavailable' });
  }
  if (!user || user.role !== 'admin') {
    return res.status(401).json({ success: false, message: 'Admin access required', reason: 'admin_unavailable' });
  }

  const sessionId = user.currentSession?.sessionId;
  if (
    Number(decoded.tokenVersion ?? 0) !== Number(user.tokenVersion ?? 0)
    || (decoded.sessionId && (!sessionId || decoded.sessionId !== sessionId))
  ) {
    if (sessionId && decoded.sessionId && decoded.sessionId !== sessionId) {
      return res.status(401).json({ success: false, message: 'signed_in_elsewhere', reason: 'session_invalidated' });
    }
    return res.status(401).json({ success: false, message: 'session_ended', reason: 'session_ended' });
  }

  req.user = user;
  next();
};