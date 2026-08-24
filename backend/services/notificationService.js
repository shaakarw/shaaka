const User = require('../models/User');
const Notification = require('../models/Notification');

const preferenceKeyByType = {
  NEW_POST: 'newPosts',
  NEW_SHOP: 'newShops',
  NEW_PLACE: 'newPlaces',
  NEW_SHOPPING_MALL: 'newShoppingMalls',
  NEW_MALL_SHOP: 'newMallShops',
  MAP_PLACE_ADDED: 'mapPlacesAdded',
};

const notifyUsers = async ({ type, title, message, image = '', actorId, ...ids }) => {
  const preferenceKey = preferenceKeyByType[type];
  const userFilter = actorId ? { _id: { $ne: actorId } } : {};
  if (preferenceKey) userFilter[`notificationPreferences.${preferenceKey}`] = { $ne: false };

  const users = await User.find(userFilter).select('_id');
  if (!users.length) return;

  await Notification.insertMany(users.map(user => ({
    userId: user._id,
    type,
    title,
    message,
    image,
    ...ids,
  })));
};

const notifyUser = async ({ userId, type, title, message, image = '', ...ids }) => {
  await Notification.create({ userId, type, title, message, image, ...ids });
};

module.exports = { notifyUsers, notifyUser };
