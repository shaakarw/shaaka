// routes/auth.js
const express = require('express');
const router = express.Router();
const { register, login, forgotPassword, resetPassword, changePassword, verifyCurrentPassword, getMe, checkPhone, checkId, checkUsername, verifyUser, verifyUsername } = require('../controllers/authController');
const auth = require('../middleware/auth');

// Public routes – no auth
router.post('/register', register);
router.post('/login', login);

// Logout endpoint: clears current session and increments tokenVersion
router.post('/logout', auth, async (req, res) => {
	try {
		const User = require('../models/User');
		const socketHelper = require('../socket');
		const onlineStore = require('../utils/onlineStore');
		const io = socketHelper.getIO();
		const user = await User.findById(req.user.id);
		if (!user) return res.status(404).json({ success: false, message: 'User not found' });
		const previousSocketId = user.currentSession?.socketId;
		user.currentSession = {};
		user.tokenVersion = (user.tokenVersion || 0) + 1; // revoke tokens
		user.isOnline = false;
		user.lastSeen = new Date();
		await user.save();
		try {
			if (io && previousSocketId) io.to(previousSocketId).emit('force-logout', { message: 'You have logged out of this account.' });
		} catch (error) {
			console.error('Could not disconnect the logged-out session:', error);
		}
		// update in-memory and broadcast
		onlineStore.setOnline(user._id, false);
		if (io) io.emit('user-offline', { userId: String(user._id), lastSeen: user.lastSeen });
		res.json({ success: true });
	} catch (e) {
		console.error('Logout error', e);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Session check
router.get('/session', auth, async (req, res) => {
	try {
		const user = await require('../models/User').findById(req.user.id).select('currentSession');
		if (!user) return res.status(404).json({ success: false, message: 'User not found' });
		res.json({ success: true, session: user.currentSession });
	} catch (e) {
		console.error('Session check error', e);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Existence checks for registration
router.post('/check-phone', checkPhone);
router.post('/check-id', checkId);
router.post('/check-username', checkUsername);
router.post('/verify-user', verifyUser);
router.post('/verify-username', verifyUsername);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.put('/reset-password/:token', resetPassword);
router.put('/change-password', auth, changePassword);
router.post('/verify-current-password', auth, verifyCurrentPassword);

// Protected route
router.get('/me', auth, getMe);

module.exports = router;