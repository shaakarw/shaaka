const Notification = require('../models/Notification');
const DeviceToken = require('../models/DeviceToken');
const User = require('../models/User');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const MAX_ATTEMPTS = 5;
const MAX_MESSAGES_PER_REQUEST = 100;
const RETRY_DELAY_MS = 60 * 1000;

const preferenceKeyByType = {
  NEW_POST: 'newPosts',
  NEW_SHOP: 'newShops',
  NEW_PLACE: 'newPlaces',
  NEW_SHOPPING_MALL: 'newShoppingMalls',
  NEW_MALL_SHOP: 'newMallShops',
  MAP_PLACE_ADDED: 'mapPlacesAdded',
  NEW_MESSAGE: 'messages',
  message: 'messages',
  PASSWORD_CHANGED: 'accountSecurity',
  NAME_CHANGED: 'accountSecurity',
};

const channelByType = (type, preferences) => {
  let base;
  if (type === 'NEW_MESSAGE' || type === 'message') base = 'messages';
  if (type === 'NEW_POST' || type === 'NEW_SHOP' || type === 'NEW_PLACE'
    || type === 'NEW_SHOPPING_MALL' || type === 'NEW_MALL_SHOP') base = 'marketplace';
  if (type === 'MAP_PLACE_ADDED') base = 'social';
  if (!base) base = 'account';
  const sound = preferences.notificationSound !== false;
  const vibration = preferences.vibration !== false;
  return `${base}${sound ? '' : '-no-sound'}${vibration ? '' : '-no-vibration'}`;
};

const expoAccessToken = () => process.env.EXPO_ACCESS_TOKEN;

const expoHeaders = () => ({
  Accept: 'application/json',
  'Accept-Encoding': 'gzip, deflate',
  'Content-Type': 'application/json',
  ...(expoAccessToken() ? { Authorization: `Bearer ${expoAccessToken()}` } : {}),
});

const postJson = async (url, body) => {
  if (typeof fetch !== 'function') throw new Error('Node.js fetch is required for Expo push delivery');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: expoHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(`Expo push service returned HTTP ${response.status}`);
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
};

const scheduleRetry = async (notification, error) => {
  await Notification.updateOne(
    { _id: notification._id },
    {
      $set: {
        deliveryStatus: 'failed',
        deliveryRetryAt: new Date(Date.now() + RETRY_DELAY_MS * (2 ** Math.max(0, notification.deliveryAttemptCount - 1))),
        deliveryError: String(error?.message || error).slice(0, 300),
      },
    }
  );
  console.error(`[Push] Delivery attempt failed for notification ${notification._id}:`, error?.message || error);
};

const processNotification = async notificationId => {
  const now = new Date();
  const notification = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      deliveryStatus: { $in: ['pending', 'failed'] },
      deliveryRetryAt: { $lte: now },
      deliveryAttemptCount: { $lt: MAX_ATTEMPTS },
    },
    {
      $set: { deliveryStatus: 'sending', deliveryStartedAt: now },
      $inc: { deliveryAttemptCount: 1 },
    },
    { new: true }
  );
  if (!notification) return;

  try {
    const user = await User.findById(notification.userId).select('notificationPreferences');
    const preferenceKey = preferenceKeyByType[notification.type];
    if (!user || (preferenceKey && user.notificationPreferences?.[preferenceKey] === false)) {
      await Notification.updateOne({ _id: notification._id }, { $set: { deliveryStatus: 'skipped' } });
      return;
    }

    const deviceTokens = await DeviceToken.find({ userId: notification.userId, status: 'active' })
      .select('_id token platform');
    if (!deviceTokens.length) {
      await Notification.updateOne({ _id: notification._id }, { $set: { deliveryStatus: 'skipped' } });
      return;
    }

    const knownDeliveryIds = new Set(notification.deliveryAttempts.map(item => String(item.deviceTokenId)));
    const newDeliveries = deviceTokens
      .filter(device => !knownDeliveryIds.has(String(device._id)))
      .map(device => ({ deviceTokenId: device._id, status: 'pending' }));
    if (newDeliveries.length) {
      await Notification.updateOne(
        { _id: notification._id },
        { $push: { deliveryAttempts: { $each: newDeliveries } } }
      );
    }

    const deliveries = await Notification.findById(notification._id)
      .select('deliveryAttempts type title message image destination destinationParams');
    const activeIds = new Set(deviceTokens.map(device => String(device._id)));
    const badgeCount = await Notification.countDocuments({
      userId: notification.userId,
      isRead: false,
      createdAt: { $gt: new Date(Date.now() - 259200000) },
    });
    const pending = deliveries.deliveryAttempts.filter(item =>
      item.status !== 'accepted' && activeIds.has(String(item.deviceTokenId))
    );
    const prefs = user.notificationPreferences || {};
    for (let offset = 0; offset < pending.length; offset += MAX_MESSAGES_PER_REQUEST) {
      const batch = pending.slice(offset, offset + MAX_MESSAGES_PER_REQUEST);
      const batchTokens = batch.map(item => deviceTokens.find(device => String(device._id) === String(item.deviceTokenId)));
      const payload = batch.map((item, index) => {
        const device = batchTokens[index];
        const data = {
          notificationId: String(notification._id),
          type: deliveries.type,
          destination: deliveries.destination,
          params: deliveries.destinationParams || {},
        };
        const message = {
          to: device.token,
          title: deliveries.title,
          body: deliveries.message,
          data,
          badge: badgeCount,
          sound: prefs.notificationSound === false ? undefined : 'default',
          priority: 'high',
          channelId: channelByType(deliveries.type, prefs),
          ...(deliveries.image ? { richContent: { image: deliveries.image } } : {}),
          ...(deliveries.type === 'NEW_MESSAGE'
            ? { threadId: String(deliveries.destinationParams?.sellerId || notification.conversationId || notification._id) }
            : {}),
        };
        return message;
      });

      const result = await postJson(EXPO_PUSH_URL, payload);
      const tickets = result?.data;
      if (!Array.isArray(tickets) || tickets.length !== batch.length) {
        throw new Error('Expo push service returned an unexpected ticket count');
      }

      for (let index = 0; index < tickets.length; index += 1) {
        const ticket = tickets[index];
        const delivery = batch[index];
        const device = batchTokens[index];
        if (ticket.status === 'ok' && ticket.id) {
          await Notification.updateOne(
            { _id: notification._id, 'deliveryAttempts.deviceTokenId': delivery.deviceTokenId },
            {
              $set: {
                'deliveryAttempts.$.status': 'accepted',
                'deliveryAttempts.$.ticketId': ticket.id,
                'deliveryAttempts.$.error': '',
              },
            }
          );
        } else {
          const errorCode = ticket.details?.error || ticket.message || 'PushTicketError';
          if (errorCode === 'DeviceNotRegistered') {
            await DeviceToken.updateOne({ _id: device._id }, { $set: { status: 'invalid' } });
          }
          await Notification.updateOne(
            { _id: notification._id, 'deliveryAttempts.deviceTokenId': delivery.deviceTokenId },
            {
              $set: {
                'deliveryAttempts.$.status': 'failed',
                'deliveryAttempts.$.error': String(errorCode).slice(0, 200),
              },
            }
          );
        }
      }
    }

    const latest = await Notification.findById(notification._id).select('deliveryAttempts');
    const activeDeliveryAttempts = latest.deliveryAttempts.filter(item => activeIds.has(String(item.deviceTokenId)));
    const hasPending = activeDeliveryAttempts.some(item => item.status !== 'accepted');
    if (hasPending) {
      await scheduleRetry(notification, new Error('One or more device deliveries failed'));
    } else {
      await Notification.updateOne(
        { _id: notification._id },
        {
          $set: {
            deliveryStatus: 'accepted',
            deliveryRetryAt: new Date(Date.now() + 15 * 60 * 1000),
            receiptCheckAt: new Date(Date.now() + 15 * 60 * 1000),
          },
        }
      );
    }
  } catch (error) {
    await scheduleRetry(notification, error);
  }
};

const processPushReceipts = async () => {
  const due = await Notification.find({
    deliveryStatus: 'accepted',
    receiptCheckAt: { $lte: new Date() },
    'deliveryAttempts.ticketId': { $exists: true, $ne: '' },
  }).limit(50).select('_id deliveryAttempts');

  for (const notification of due) {
    const ticketIds = notification.deliveryAttempts
      .filter(item => item.status === 'accepted' && item.ticketId)
      .map(item => item.ticketId);
    if (!ticketIds.length) {
      await Notification.updateOne({ _id: notification._id }, { $set: { deliveryStatus: 'delivered' } });
      continue;
    }

    try {
      const result = await postJson(EXPO_RECEIPTS_URL, { ids: ticketIds });
      const receipts = result?.data || {};
      let allReady = true;
      let receiptFailed = false;
      for (const delivery of notification.deliveryAttempts) {
        if (!delivery.ticketId || delivery.status !== 'accepted') continue;
        const receipt = receipts[delivery.ticketId];
        if (!receipt) {
          allReady = false;
          continue;
        }
        if (receipt.status === 'error') {
          receiptFailed = true;
          const errorCode = receipt.details?.error || receipt.message || 'PushReceiptError';
          if (errorCode === 'DeviceNotRegistered') {
            await DeviceToken.updateOne({ _id: delivery.deviceTokenId }, { $set: { status: 'invalid' } });
          }
          await Notification.updateOne(
            { _id: notification._id, 'deliveryAttempts.deviceTokenId': delivery.deviceTokenId },
            {
              $set: {
                'deliveryAttempts.$.status': 'failed',
                'deliveryAttempts.$.error': String(errorCode).slice(0, 200),
                deliveryStatus: 'failed',
                deliveryRetryAt: new Date(Date.now() + RETRY_DELAY_MS),
              },
            }
          );
        }
      }
      if (allReady) {
        await Notification.updateOne(
          { _id: notification._id },
          { $set: { deliveryStatus: receiptFailed ? 'failed' : 'delivered' } }
        );
      } else {
        await Notification.updateOne(
          { _id: notification._id },
          { $set: { receiptCheckAt: new Date(Date.now() + RETRY_DELAY_MS) } }
        );
      }
    } catch (error) {
      console.error(`[Push] Receipt check failed for notification ${notification._id}:`, error?.message || error);
      await Notification.updateOne(
        { _id: notification._id },
        { $set: { receiptCheckAt: new Date(Date.now() + RETRY_DELAY_MS) } }
      );
    }
  }
};

const processPendingNotifications = async () => {
  await Notification.updateMany(
    { deliveryStatus: 'sending', deliveryStartedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } },
    { $set: { deliveryStatus: 'pending', deliveryRetryAt: new Date() } }
  );
  const pending = await Notification.find({
    deliveryStatus: { $in: ['pending', 'failed'] },
    deliveryRetryAt: { $lte: new Date() },
    deliveryAttemptCount: { $lt: MAX_ATTEMPTS },
  }).sort({ createdAt: 1 }).limit(50).select('_id');
  await Promise.all(pending.map(item => processNotification(item._id).catch(error => {
    console.error(`[Push] Queue processing failed for notification ${item._id}:`, error?.message || error);
  })));
  await processPushReceipts();
};

const queueNotification = notificationId => {
  setImmediate(() => {
    processNotification(notificationId).catch(error => {
      console.error(`[Push] Failed to dispatch notification ${notificationId}:`, error?.message || error);
    });
  });
};

module.exports = { queueNotification, processPendingNotifications };
