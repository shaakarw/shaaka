// backend/utils/messageRetention.js
// Utility to clean up old messages and Cloudinary assets based on user retention settings

const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const storageService = require('../services/storage/storageService');
const { getMessageStorageKeys, deleteStorageKeys } = require('./deletionCleanup');

async function cleanupOldMessages(options = {}) {
  const { batchSize = 1000, dryRun = false } = options;
  const now = new Date();
  let totalMessagesDeleted = 0;
  let totalAssetsDeleted = 0;
  let totalAssetsFailed = 0;

  console.log(`[Retention] Starting cleanup at ${now.toISOString()} (dryRun=${dryRun})`);

  const users = await User.find({}, { _id: 1, imagesPerMessage: 1, imagesRetentionDays: 1, messagesRetentionDays: 1 });
  console.log(`[Retention] Found ${users.length} users to process`);

  for (const user of users) {
    const userId = user._id;
    const imagesRetentionDays = typeof user.imagesRetentionDays === 'number' ? user.imagesRetentionDays : 5;
    const messagesRetentionDays = typeof user.messagesRetentionDays === 'number' ? user.messagesRetentionDays : 30;

    const imageCutoff = new Date(now);
    imageCutoff.setDate(imageCutoff.getDate() - imagesRetentionDays);

    const messageCutoff = new Date(now);
    messageCutoff.setDate(messageCutoff.getDate() - messagesRetentionDays);

    const oldImageMessages = await Message.find({
      senderId: userId,
      imageUrl: { $exists: true, $ne: '' },
      createdAt: { $lt: imageCutoff },
    }).limit(batchSize).lean();

    if (oldImageMessages.length > 0) {
      const storageKeys = oldImageMessages.flatMap(getMessageStorageKeys);
      const messageIds = oldImageMessages.map(m => m._id);
      if (!dryRun) {
        await Message.deleteMany({ _id: { $in: messageIds } });
        for (const key of storageKeys) {
          try {
            await storageService.deleteMedia(key);
            totalAssetsDeleted++;
          } catch (error) {
            totalAssetsFailed++;
            console.error('[Retention] B2 media deletion failed:', error.code || 'B2_OPERATION_FAILED');
          }
        }
      } else {
        totalAssetsDeleted += storageKeys.length;
      }
      totalMessagesDeleted += oldImageMessages.length;
    }

    const oldMessages = await Message.find({
      senderId: userId,
      imageUrl: { $or: [{ $exists: false }, { $eq: '' }] },
      createdAt: { $lt: messageCutoff },
    }).limit(batchSize).lean();

    if (oldMessages.length > 0) {
      const messageIds = oldMessages.map(m => m._id);
      if (!dryRun) {
        await Message.deleteMany({ _id: { $in: messageIds } });
      }
      totalMessagesDeleted += oldMessages.length;
    }
  }

  console.log(`[Retention] Cleanup complete. Messages deleted: ${totalMessagesDeleted}, Assets deleted: ${totalAssetsDeleted}, Assets failed: ${totalAssetsFailed}`);
  return {
    totalMessagesDeleted,
    totalAssetsDeleted,
    totalAssetsFailed,
    usersProcessed: users.length,
  };
}

async function cleanupOrphanedMedia() {
  console.log('[Retention] Orphan scan requires B2 bucket inventory; no media was deleted.');
  return { deletedCount: 0 };
}

module.exports = {
  cleanupOldMessages,
  cleanupOrphanedMedia,
};
