const DeviceToken = require('../models/DeviceToken');

const isValidExpoPushToken = token => (
  typeof token === 'string'
  && token.length <= 512
  && /^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/.test(token)
);

exports.registerDevice = async (req, res) => {
  const { token, platform, deviceId } = req.body || {};
  if (!isValidExpoPushToken(token)) {
    return res.status(400).json({ success: false, message: 'A valid Expo push token is required' });
  }
  if (!['android', 'ios'].includes(platform)) {
    return res.status(400).json({ success: false, message: 'Platform must be android or ios' });
  }
  if (typeof deviceId !== 'string' || !/^[A-Za-z0-9:_-]{8,128}$/.test(deviceId)) {
    return res.status(400).json({ success: false, message: 'A valid device identifier is required' });
  }

  try {
    const existingToken = await DeviceToken.findOne({ token });
    if (existingToken && String(existingToken.userId) !== String(req.user.id)) {
      return res.status(409).json({ success: false, message: 'This push token is registered to another account' });
    }

    await DeviceToken.findOneAndUpdate(
      { userId: req.user.id, deviceId },
      {
        $set: { token, platform, status: 'active', lastSeenAt: new Date() },
        $setOnInsert: { userId: req.user.id, deviceId },
      },
      { upsert: true, new: true, runValidators: true }
    );
    return res.json({ success: true });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'This device is already registered' });
    }
    console.error('Register push device error:', error.code || error.message || 'Unknown error');
    return res.status(500).json({ success: false, message: 'Failed to register push device' });
  }
};

exports.unregisterDevice = async (req, res) => {
  const { deviceId } = req.body || {};
  if (typeof deviceId !== 'string' || !/^[A-Za-z0-9:_-]{8,128}$/.test(deviceId)) {
    return res.status(400).json({ success: false, message: 'A valid device identifier is required' });
  }
  try {
    await DeviceToken.updateOne(
      { userId: req.user.id, deviceId },
      { $set: { status: 'inactive' } }
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Unregister push device error:', error.code || error.message || 'Unknown error');
    return res.status(500).json({ success: false, message: 'Failed to unregister push device' });
  }
};
