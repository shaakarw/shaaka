const express = require('express');
const auth = require('../middleware/auth');
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  createNotification,
  getPreferences,
  updatePreferences,
} = require('../controllers/notificationController');

const router = express.Router();
router.use(auth);
router.get('/', getNotifications);
router.get('/preferences', getPreferences);
router.patch('/preferences', updatePreferences);
router.post('/', createNotification);
router.patch('/:id/read', markNotificationRead);
router.patch('/read-all', markAllNotificationsRead);

module.exports = router;
