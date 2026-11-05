// controllers/authController.js
const User = require('../models/User');
const Post = require('../models/Post');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const { normalizeRwandaPhone, isValidRwandaPhone, normalizeForAuth } = require('../utils/phoneNormalizer');
const { notifyUser } = require('../services/notificationService');

const generateToken = (id, tokenVersion = 0, sessionId = '', deviceId = '') => {
  return jwt.sign({ id, tokenVersion, sessionId, deviceId }, process.env.JWT_SECRET);
};

// @route   POST /api/auth/register
// @desc    Register a new user
exports.register = async (req, res) => {
  try {
    const { phone, idNumber, username, password } = req.body;

    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const normalizedPhone = normalizeForAuth(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ success: false, message: 'Please enter a valid Rwanda phone number (e.g. 0781234567)' });
    }

    if (await User.findOne({ phone: normalizedPhone }))
      return res.status(400).json({ success: false, message: 'Phone number already registered' });
    if (await User.findOne({ idNumber }))
      return res.status(400).json({ success: false, message: 'ID number already registered' });
    if (await User.findOne({ username: username.toLowerCase() }))
      return res.status(400).json({ success: false, message: 'Username already taken' });

    const user = await User.create({
      phone: normalizedPhone,
      idNumber,
      username: username.toLowerCase(),
      password,
      lastActiveAt: new Date(),
    });

    const token = generateToken(user._id, user.tokenVersion);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        phone: user.phone,
        idNumber: user.idNumber,
        username: user.username,
        role: user.role || 'user',
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @route   POST /api/auth/login
// @desc    Login user – with blocked check
exports.login = async (req, res) => {
  try {
    const { identifier, phone, password } = req.body;
    const loginIdentifier = identifier || phone;

    if (!loginIdentifier)
      return res.status(400).json({ success: false, message: 'Phone or username is required' });

    const normalizedPhone = isValidRwandaPhone(loginIdentifier) ? normalizeForAuth(loginIdentifier) : null;

    const user = await User.findOne({ phone: normalizedPhone || loginIdentifier }) ||
      await User.findOne({ username: String(loginIdentifier).toLowerCase() });

    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid phone or password' });

    // ✅ BLOCKED CHECK – if user is blocked, reject login
    if (user.blocked) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked. Please contact support.',
      });
    }

    const prevSession = user.currentSession && user.currentSession.sessionId ? { ...user.currentSession } : null;

    // create new sessionId & record deviceId (if provided)
    const deviceId = req.body.deviceId || crypto.randomBytes(8).toString('hex');
    const sessionId = crypto.randomBytes(16).toString('hex');

    if (user.accountDeletionStatus === 'scheduled') {
      user.accountDeletionStatus = 'active';
      user.accountDeletionScheduledAt = null;
      user.accountDeletionNotifiedAt = null;
    }
    user.lastActiveAt = new Date();
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.currentSession = {
      sessionId,
      deviceId,
      socketId: '',
      createdAt: new Date(),
      lastSeen: new Date(),
    };
    await user.save();

    const token = generateToken(user._id, user.tokenVersion, sessionId, deviceId);
    // mark online and notify clients
    try {
      const socketHelper = require('../socket');
      const onlineStore = require('../utils/onlineStore');
      const io = socketHelper.getIO();
      onlineStore.setOnline(user._id, true);
      if (io) io.emit('user-online', { userId: String(user._id), lastSeen: null });
    } catch (e) {}

    // ✅ NOW INCLUDING role and other fields
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        phone: user.phone,
        idNumber: user.idNumber,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role || 'user',
        avatar: user.avatar,
        location: user.location,
        bio: user.bio,
      },
      session: { sessionId, deviceId },
    });

    // notify previous session (force logout) if connected via socket
    try {
      const socketHelper = require('../socket');
      const io = socketHelper.getIO();
      if (io && prevSession && prevSession.socketId) {
        io.to(prevSession.socketId).emit('force-logout', { message: 'Your account has been signed in on another device.' });
      }
    } catch (e) {
      // ignore
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   POST /api/auth/check-phone
// @desc    Check if phone number exists
exports.checkPhone = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone is required' });
    const user = await User.findOne({ phone });
    return res.json({ success: true, exists: !!user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   POST /api/auth/check-id
// @desc    Check if ID number exists
exports.checkId = async (req, res) => {
  try {
    const { idNumber } = req.body;
    if (!idNumber) return res.status(400).json({ success: false, message: 'ID number is required' });
    const user = await User.findOne({ idNumber });
    return res.json({ success: true, exists: !!user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   POST /api/auth/check-username
// @desc    Check if username exists
exports.checkUsername = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ success: false, message: 'Username is required' });
    const user = await User.findOne({ username: String(username).toLowerCase() });
    return res.json({ success: true, exists: !!user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   POST /api/auth/verify-user
// @desc    Verify phone and ID before password reset
exports.verifyUser = async (req, res) => {
  try {
    const { phone, idNumber } = req.body;
    if (!phone || !idNumber) {
      return res.status(400).json({ success: false, message: 'Phone and ID are required' });
    }

    const user = await User.findOne({ phone, idNumber });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with the provided information' });
    }

    return res.json({ success: true, userId: user._id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   POST /api/auth/verify-username
// @desc    Verify the username for the identified user
exports.verifyUsername = async (req, res) => {
  try {
    const { userId, username } = req.body;
    if (!userId || !username) {
      return res.status(400).json({ success: false, message: 'User ID and username are required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (String(user.username).toLowerCase() !== String(username).toLowerCase()) {
      return res.status(400).json({ success: false, message: 'Username does not match the account' });
    }

    return res.json({ success: true, message: 'Username verified' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   POST /api/auth/forgot-password
// @desc    Generate password reset token
exports.forgotPassword = async (req, res) => {
  const { phone } = req.body;
  try {
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });
      const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
      await transporter.sendMail({
        to: user.email,
        subject: 'Password Reset',
        html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 10 minutes.</p>`,
      });
    }

    res.json({ success: true, message: 'Reset token generated', resetToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   POST /api/auth/reset-password
// @desc    Reset password using a verified user ID or an email reset token
exports.resetPassword = async (req, res) => {
  try {
    if (req.body.userId) {
      const user = await User.findById(req.body.userId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      const sameAsCurrent = await bcrypt.compare(req.body.newPassword, user.password);
      const sameAsHistory = await Promise.all((user.passwordHistory || []).map((oldHash) => bcrypt.compare(req.body.newPassword, oldHash)));
      if (sameAsCurrent || sameAsHistory.some(Boolean)) {
        return res.status(400).json({ success: false, message: 'Password already used' });
      }

      user.password = req.body.newPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      try { await notifyUser({ userId: user._id, type: 'PASSWORD_CHANGED', title: 'Password Changed', message: 'Your password was successfully changed.', eventKey: `PASSWORD_CHANGED:${user._id}:${user.updatedAt.getTime()}` }); } catch (notificationError) { console.error('Password notification error:', notificationError); }

      return res.json({ success: true, message: 'Password updated' });
    }

    if (req.params.token) {
      const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
      const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() },
      });
      if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired token' });

      const sameAsCurrent = await bcrypt.compare(req.body.password, user.password);
      const sameAsHistory = await Promise.all((user.passwordHistory || []).map((oldHash) => bcrypt.compare(req.body.password, oldHash)));
      if (sameAsCurrent || sameAsHistory.some(Boolean)) {
        return res.status(400).json({ success: false, message: 'Password already used' });
      }

      user.password = req.body.password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      try { await notifyUser({ userId: user._id, type: 'PASSWORD_CHANGED', title: 'Password Changed', message: 'Your password was successfully changed.', eventKey: `PASSWORD_CHANGED:${user._id}:${user.updatedAt.getTime()}` }); } catch (notificationError) { console.error('Password notification error:', notificationError); }

      return res.json({ success: true, message: 'Password updated' });
    }

    return res.status(400).json({ success: false, message: 'User ID or reset token is required' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   GET /api/auth/me
// @desc    Get current logged-in user
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const userObj = user.toObject();

    res.json({ success: true, user: userObj });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Current and new passwords are required' });
    if (newPassword.length < 4 || /\s/.test(newPassword)) return res.status(400).json({ success: false, message: 'Password must be at least 4 characters without spaces' });
    const user = await User.findById(req.user.id);
    if (!user || !(await user.matchPassword(currentPassword))) return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    if (await bcrypt.compare(newPassword, user.password)) return res.status(400).json({ success: false, message: 'Password already used' });
    user.password = newPassword;
    await user.save();
    try { await notifyUser({ userId: user._id, type: 'PASSWORD_CHANGED', title: 'Password Changed', message: 'Your password was successfully changed.', eventKey: `PASSWORD_CHANGED:${user._id}:${user.updatedAt.getTime()}` }); } catch (notificationError) { console.error('Password notification error:', notificationError); }
    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.verifyCurrentPassword = async (req, res) => {
  try {
    const { currentPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user || !currentPassword || !(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Verify current password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};