const Notification = require('../models/Notification');
const User = require('../models/User');

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      userId: req.user.id,
      createdAt: { $gt: new Date(Date.now() - 259200000) },
    }).select('-deliveryAttempts -deliveryError').sort({ createdAt: -1 });
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
    const unreadCount = await Notification.countDocuments({
      userId: req.user.id,
      isRead: false,
      createdAt: { $gt: new Date(Date.now() - 259200000) },
    });
    res.json({ success: true, notification, unreadCount });
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
  try {
    const user = await User.findById(req.user.id).select('notificationPreferences');
    res.json({ success: true, preferences: user?.notificationPreferences || {} });
  } catch (error) {
    console.error('Get notification preferences error:', error);
    res.status(500).json({ success: false, message: 'Failed to load notification preferences' });
  }
};

exports.updatePreferences = async (req, res) => {
  const allowed = [
    'newPosts', 'newShops', 'newPlaces', 'newShoppingMalls', 'newMallShops',
    'mapPlacesAdded', 'messages', 'socialActivities', 'followers', 'marketplace',
    'orders', 'business', 'accountSecurity', 'promotional', 'notificationSound',
    'vibration',
  ];
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const updates = {};
  for (const [key, value] of Object.entries(body)) {
    if (!allowed.includes(key) || typeof value !== 'boolean') {
      return res.status(400).json({ success: false, message: `Invalid notification preference: ${key}` });
    }
    updates[`notificationPreferences.${key}`] = value;
  }
  if (!Object.keys(updates).length) {
    return res.status(400).json({ success: false, message: 'At least one notification preference is required' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('notificationPreferences');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, preferences: user.notificationPreferences });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update notification preferences' });
  }
};
