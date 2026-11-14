const Message = require('../models/Message');
const User = require('../models/User');
const storageService = require('../services/storage/storageService');
const { getMessageStorageKeys } = require('./deletionCleanup');
const {
  removeImageReferenceFromMessage,
  removeUploadedMessageImages,
} = require('./chatImageRetention');
const { getClient } = require('../config/db');
const { DEFAULT_USER_PERMISSIONS } = require('../config/userPermissions');

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const getRetentionDays = (user, field, fallback) => (
  Number.isSafeInteger(user?.[field]) && user[field] >= 0
    ? user[field]
    : fallback
);

const getMinimumRetentionDays = (usersById, field, fallback) => {
  const retentionDays = [...usersById.values()].map(user => getRetentionDays(user, field, fallback));
  return retentionDays.length ? Math.min(...retentionDays) : fallback;
};

const isExpired = (createdAt, retentionDays, now) => {
  const timestamp = new Date(createdAt).getTime();
  return Number.isFinite(timestamp) && timestamp < now.getTime() - retentionDays * DAY_IN_MS;
};

const getImageStorageKeys = message => [
  message.imageStorageKey,
  ...(Array.isArray(message.imageStorageKeys) ? message.imageStorageKeys : []),
  storageService.getStorageKeyFromUrl(message.imageUrl),
  ...(Array.isArray(message.imageUrls) ? message.imageUrls : [])
    .map(url => storageService.getStorageKeyFromUrl(url)),
].filter(storageService.isStorageKey).filter((key, index, keys) => keys.indexOf(key) === index);

const loadUsersById = async () => {
  const users = await User.find({}).select('imagesRetentionDays messagesRetentionDays').lean();
  return new Map(users.map(user => [String(user._id), user]));
};

const cleanupTrackedMessageImages = async ({ batchSize, dryRun, now, usersById, cutoff }) => {
  let lastUploadId = 0;
  let totalImagesDeleted = 0;
  let totalAssetsDeleted = 0;
  let totalAssetsFailed = 0;

  while (true) {
    const result = await getClient().execute({
      sql: `
        SELECT id, user_id, storage_key, message_id, uploaded_at
        FROM message_image_uploads
        WHERE uploaded_at < ? AND id > ?
        ORDER BY id ASC
        LIMIT ?
      `,
      args: [cutoff.toISOString(), lastUploadId, batchSize],
    });
    const uploads = result.rows;
    if (!uploads.length) break;

    for (const upload of uploads) {
      lastUploadId = Number(upload.id);
      const owner = usersById.get(String(upload.user_id));
      const retentionDays = getRetentionDays(
        owner,
        'imagesRetentionDays',
        DEFAULT_USER_PERMISSIONS.imagesRetentionDays
      );
      if (!isExpired(upload.uploaded_at, retentionDays, now)) continue;

      if (dryRun) {
        totalImagesDeleted += 1;
        totalAssetsDeleted += 1;
        continue;
      }

      try {
        await storageService.deleteMedia(upload.storage_key);
        if (upload.message_id) {
          await removeImageReferenceFromMessage(upload.message_id, upload.storage_key);
        }
        await getClient().execute({
          sql: 'DELETE FROM message_image_uploads WHERE id = ?',
          args: [upload.id],
        });
        totalImagesDeleted += 1;
        totalAssetsDeleted += 1;
      } catch (error) {
        totalAssetsFailed += 1;
        console.error(
          '[Retention] Tracked message image cleanup failed:',
          error.code || error.message || 'TRACKED_IMAGE_CLEANUP_FAILED'
        );
      }
    }

    if (uploads.length < batchSize) break;
  }

  return { totalImagesDeleted, totalAssetsDeleted, totalAssetsFailed };
};

async function cleanupExpiredMessageImages({
  batchSize = 1000,
  dryRun = false,
  now = new Date(),
} = {}) {
  const usersById = await loadUsersById();
  const imageRetentionDays = getMinimumRetentionDays(
    usersById,
    'imagesRetentionDays',
    DEFAULT_USER_PERMISSIONS.imagesRetentionDays
  );
  const candidateCutoff = new Date(now.getTime() - imageRetentionDays * DAY_IN_MS);
  const trackedResult = await cleanupTrackedMessageImages({
    batchSize,
    dryRun,
    now,
    usersById,
    cutoff: candidateCutoff,
  });
  let lastMessageId = '';
  let totalMessagesChecked = 0;
  let totalImagesDeleted = trackedResult.totalImagesDeleted;
  let totalAssetsDeleted = trackedResult.totalAssetsDeleted;
  let totalAssetsFailed = trackedResult.totalAssetsFailed;

  while (true) {
    const filter = {
      createdAt: { $lt: candidateCutoff },
      imageUrl: { $exists: true, $ne: '' },
      _id: { $gt: lastMessageId },
    };
    const messages = await Message.find(filter)
      .sort({ _id: 1 })
      .limit(batchSize)
      .lean();
    if (!messages.length) break;

    totalMessagesChecked += messages.length;
    for (const message of messages) {
      lastMessageId = String(message._id);
      const owner = usersById.get(String(message.senderId));
      const retentionDays = getRetentionDays(
        owner,
        'imagesRetentionDays',
        DEFAULT_USER_PERMISSIONS.imagesRetentionDays
      );
      if (!isExpired(message.createdAt, retentionDays, now)) continue;

      const storageKeys = getImageStorageKeys(message);
      if (dryRun) {
        totalImagesDeleted += Array.isArray(message.imageUrls) && message.imageUrls.length
          ? message.imageUrls.length
          : 1;
        totalAssetsDeleted += storageKeys.length;
        continue;
      }

      if (!storageKeys.length) {
        totalAssetsFailed += 1;
        console.error('[Retention] Expired message image has no recognized storage key:', String(message._id));
        continue;
      }

      const deletionResults = await Promise.allSettled(
        storageKeys.map(key => storageService.deleteMedia(key))
      );
      const failedDeletions = deletionResults.filter(result => result.status === 'rejected');
      totalAssetsDeleted += deletionResults.length - failedDeletions.length;
      totalAssetsFailed += failedDeletions.length;
      if (failedDeletions.length) {
        failedDeletions.forEach(result => {
          console.error(
            '[Retention] Message image deletion failed:',
            result.reason?.code || result.reason?.message || 'STORAGE_DELETE_FAILED'
          );
        });
        continue;
      }

      try {
        await Message.findByIdAndUpdate(message._id, {
          $set: {
            imageUrl: '',
            imageUrls: [],
            imageStorageKey: '',
            imageStorageKeys: [],
          },
        });
        totalImagesDeleted += Array.isArray(message.imageUrls) && message.imageUrls.length
          ? message.imageUrls.length
          : 1;
      } catch (error) {
        totalAssetsFailed += 1;
        console.error(
          '[Retention] Could not clear expired image references:',
          error.code || error.message || 'DATABASE_UPDATE_FAILED'
        );
      }
    }

    if (messages.length < batchSize) break;
  }

  console.log(
    `[Retention] Image cleanup complete. Images removed: ${totalImagesDeleted}, `
    + `Assets deleted: ${totalAssetsDeleted}, Assets failed: ${totalAssetsFailed}`
  );
  return {
    totalMessagesChecked,
    totalImagesDeleted,
    totalAssetsDeleted,
    totalAssetsFailed,
    retentionDays: DEFAULT_USER_PERMISSIONS.imagesRetentionDays,
  };
}

async function cleanupOldMessages({
  batchSize = 1000,
  dryRun = false,
  now = new Date(),
} = {}) {
  const usersById = await loadUsersById();
  const messageRetentionDays = getMinimumRetentionDays(
    usersById,
    'messagesRetentionDays',
    DEFAULT_USER_PERMISSIONS.messagesRetentionDays
  );
  const candidateCutoff = new Date(now.getTime() - messageRetentionDays * DAY_IN_MS);
  let lastMessageId = '';
  let totalMessagesDeleted = 0;
  let totalAssetsDeleted = 0;
  let totalAssetsFailed = 0;
  let messagesChecked = 0;

  while (true) {
    const filter = {
      createdAt: { $lt: candidateCutoff },
      _id: { $gt: lastMessageId },
    };
    const messages = await Message.find(filter)
      .sort({ _id: 1 })
      .limit(batchSize)
      .lean();
    if (!messages.length) break;

    messagesChecked += messages.length;
    for (const message of messages) {
      lastMessageId = String(message._id);
      const owner = usersById.get(String(message.senderId));
      const retentionDays = getRetentionDays(
        owner,
        'messagesRetentionDays',
        DEFAULT_USER_PERMISSIONS.messagesRetentionDays
      );
      if (!isExpired(message.createdAt, retentionDays, now)) continue;

      if (dryRun) {
        totalMessagesDeleted += 1;
        totalAssetsDeleted += getMessageStorageKeys(message).length;
        continue;
      }

      const storageKeys = getMessageStorageKeys(message);
      const deletionResults = await Promise.allSettled(
        storageKeys.map(key => storageService.deleteMedia(key))
      );
      const failedDeletions = deletionResults.filter(result => result.status === 'rejected');
      totalAssetsDeleted += deletionResults.length - failedDeletions.length;
      totalAssetsFailed += failedDeletions.length;
      if (failedDeletions.length) {
        failedDeletions.forEach(result => {
          console.error(
            '[Retention] Message media deletion failed:',
            result.reason?.code || result.reason?.message || 'STORAGE_DELETE_FAILED'
          );
        });
        continue;
      }

      try {
        const deletedMessage = await Message.findByIdAndDelete(message._id);
        if (deletedMessage) {
          totalMessagesDeleted += 1;
          await removeUploadedMessageImages(storageKeys);
        }
      } catch (error) {
        totalAssetsFailed += 1;
        console.error(
          '[Retention] Could not delete expired message record:',
          error.code || error.message || 'DATABASE_DELETE_FAILED'
        );
      }
    }

    if (messages.length < batchSize) break;
  }

  console.log(
    `[Retention] Cleanup complete. Messages deleted: ${totalMessagesDeleted}, `
    + `Assets deleted: ${totalAssetsDeleted}, Assets failed: ${totalAssetsFailed}`
  );
  return {
    totalMessagesDeleted,
    totalAssetsDeleted,
    totalAssetsFailed,
    messagesChecked,
    retentionDays: DEFAULT_USER_PERMISSIONS.messagesRetentionDays,
  };
}

async function cleanupOrphanedMedia() {
  console.log('[Retention] Orphan scan requires B2 bucket inventory; no media was deleted.');
  return { deletedCount: 0 };
}

module.exports = {
  cleanupExpiredMessageImages,
  cleanupOldMessages,
  cleanupOrphanedMedia,
  isExpired,
  MESSAGE_RETENTION_DAYS: DEFAULT_USER_PERMISSIONS.messagesRetentionDays,
};
