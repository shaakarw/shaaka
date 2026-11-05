const User = require('../models/User');
const Notification = require('../models/Notification');
const { queueNotification } = require('./pushNotificationService');

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

const resolveEventKey = ({ type, eventKey, postId, shopId, placeId, shoppingMallId, mallShopId, messageId }) => {
  if (eventKey) return String(eventKey);
  const relatedId = postId || shopId || placeId || shoppingMallId || mallShopId || messageId;
  return relatedId ? `${type}:${relatedId}` : undefined;
};

const resolveDestination = ({ type, destination, destinationParams, postId, shopId, placeId, shoppingMallId, mallShopId }) => {
  if (destination) return { destination, destinationParams };
  if (postId) return { destination: 'PostDetail', destinationParams: { postId: String(postId) } };
  if (mallShopId) return { destination: 'ViewShop', destinationParams: { shopId: String(mallShopId) } };
  const placeKey = shopId ? 'shopId' : shoppingMallId ? 'shoppingMallId' : placeId ? 'placeId' : '';
  if (placeKey) {
    return {
      destination: 'ViewPlace',
      destinationParams: { placeId: String(shopId || shoppingMallId || placeId) },
    };
  }
  if (type === 'PASSWORD_CHANGED') return { destination: 'ChangePassword', destinationParams: {} };
  if (type === 'NAME_CHANGED') return { destination: 'Settings', destinationParams: {} };
  return { destination: '', destinationParams: {} };
};

const createNotification = async payload => {
  const {
    userId,
    actorId,
    type,
    title,
    message,
    image = '',
    destination = '',
    destinationParams = {},
    ...relatedIds
  } = payload;
  const preferenceKey = preferenceKeyByType[type];
  if (preferenceKey) {
    const user = await User.findById(userId).select(`notificationPreferences.${preferenceKey}`);
    if (!user || user.notificationPreferences?.[preferenceKey] === false) return null;
  }

  const eventKey = resolveEventKey({ type, ...relatedIds });
  const navigation = resolveDestination({
    type,
    destination,
    destinationParams,
    ...relatedIds,
  });
  let notification;
  try {
    notification = await Notification.create({
      userId,
      senderId: actorId,
      type,
      title,
      message,
      image,
      ...navigation,
      eventKey,
      ...relatedIds,
    });
  } catch (error) {
    if (error?.code === 11000 && eventKey) return null;
    throw error;
  }

  queueNotification(notification._id);
  return notification;
};

const notifyUsers = async ({ type, title, message, image = '', actorId, ...relatedIds }) => {
  const preferenceKey = preferenceKeyByType[type];
  const userFilter = actorId ? { _id: { $ne: actorId } } : {};
  if (preferenceKey) userFilter[`notificationPreferences.${preferenceKey}`] = { $ne: false };

  const users = await User.find(userFilter).select('_id');
  if (!users.length) return;

  const eventKey = resolveEventKey({ type, ...relatedIds });
  const operations = users.map(user => {
    const document = new Notification({
      userId: user._id,
      senderId: actorId,
      type,
      title,
      message,
      image,
      ...resolveDestination({ type, ...relatedIds }),
      eventKey,
      ...relatedIds,
    }).toObject();
    if (!eventKey) return { insertOne: { document } };
    return {
      updateOne: {
        filter: { userId: user._id, eventKey },
        update: { $setOnInsert: document },
        upsert: true,
      },
    };
  });

  try {
    const result = await Notification.bulkWrite(operations, { ordered: false });
    const createdIds = [
      ...Object.values(result.upsertedIds || {}),
      ...Object.values(result.insertedIds || {}),
    ];
    createdIds.forEach(queueNotification);
  } catch (error) {
    console.error('[Notifications] Could not create broadcast notifications:', error?.message || error);
  }
};

const notifyUser = async payload => createNotification(payload);

module.exports = { notifyUsers, notifyUser };
