const express = require('express');
const auth = require('../middleware/auth');
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getPreferences,
  updatePreferences,
} = require('../controllers/notificationController');
const { registerDevice, unregisterDevice } = require('../controllers/notificationDeviceController');

const router = express.Router();
router.use(auth);
router.get('/', getNotifications);
router.get('/preferences', getPreferences);
router.patch('/preferences', updatePreferences);
router.post('/devices', registerDevice);
router.delete('/devices', unregisterDevice);
router.patch('/:id/read', markNotificationRead);
router.patch('/read-all', markAllNotificationsRead);

module.exports = router;
