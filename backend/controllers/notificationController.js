const Notification = require('../models/Notification');
const { notifyUser } = require('../services/notificationService');

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      userId: req.user.id,
      createdAt: { $gt: new Date(Date.now() - 259200000) },
    }).sort({ createdAt: -1 });
    const unreadCount = notifications.reduce((count, item) => count + (item.isRead ? 0 : 1), 0);
    res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to load notifications' });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, notification });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ success: false, message: 'Failed to update notification' });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id, isRead: false }, { isRead: true });
    res.json({ success: true, unreadCount: 0 });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ success: false, message: 'Failed to update notifications' });
  }
};

exports.getPreferences = async (req, res) => {
  const user = await require('../models/User').findById(req.user.id).select('notificationPreferences');
  res.json({ success: true, preferences: user?.notificationPreferences || {} });
};

exports.updatePreferences = async (req, res) => {
  const allowed = ['newPosts', 'newShops', 'newPlaces', 'newShoppingMalls', 'newMallShops', 'mapPlacesAdded'];
  const updates = {};
  allowed.forEach(key => {
    if (typeof req.body[key] === 'boolean') updates[`notificationPreferences.${key}`] = req.body[key];
  });
  const user = await require('../models/User').findByIdAndUpdate(req.user.id, { $set: updates }, { new: true }).select('notificationPreferences');
  res.json({ success: true, preferences: user.notificationPreferences });
};

// Kept for the existing chat notification call; all records remain scoped to a user.
exports.createNotification = async (req, res) => {
  try {
    const { userId, type = 'NEW_POST', title = 'Notification', message, image, data = {} } = req.body;
    if (!userId || !message) return res.status(400).json({ success: false, message: 'userId and message are required' });
    await notifyUser({ userId, type, title, message, image, ...data });
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ success: false, message: 'Failed to create notification' });
  }
};
