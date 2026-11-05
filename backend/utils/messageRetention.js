const Message = require('../models/Message');
const storageService = require('../services/storage/storageService');
const { getMessageStorageKeys } = require('./deletionCleanup');

const MESSAGE_RETENTION_DAYS = 30;

async function cleanupOldMessages({ batchSize = 1000, dryRun = false, now = new Date() } = {}) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - MESSAGE_RETENTION_DAYS);

  let totalMessagesDeleted = 0;
  let totalAssetsDeleted = 0;
  let totalAssetsFailed = 0;
  let messagesChecked = 0;
  const failedMessageIds = [];

  while (true) {
    const filter = { createdAt: { $lt: cutoff } };
    if (failedMessageIds.length) filter._id = { $nin: failedMessageIds };
    const oldMessages = await Message.find(filter)
      .sort({ createdAt: 1 })
      .limit(batchSize)
      .lean();
    if (!oldMessages.length) break;
    messagesChecked += oldMessages.length;

    for (const message of oldMessages) {
      const storageKeys = getMessageStorageKeys(message);
      if (dryRun) {
        totalMessagesDeleted += 1;
        totalAssetsDeleted += storageKeys.length;
        continue;
      }

      const deletionResults = await Promise.allSettled(
        storageKeys.map(key => storageService.deleteMedia(key))
      );
      const failedDeletions = deletionResults.filter(result => result.status === 'rejected');
      totalAssetsDeleted += deletionResults.length - failedDeletions.length;
      totalAssetsFailed += failedDeletions.length;

      if (failedDeletions.length) {
        failedMessageIds.push(message._id);
        failedDeletions.forEach(result => {
          console.error(
            '[Retention] Message media deletion failed:',
            result.reason?.code || result.reason?.message || 'B2_OPERATION_FAILED'
          );
        });
        continue;
      }

      try {
        const deletedMessage = await Message.findByIdAndDelete(message._id);
        if (deletedMessage) totalMessagesDeleted += 1;
      } catch (error) {
        failedMessageIds.push(message._id);
        console.error(
          '[Retention] Could not delete expired message record:',
          error.code || error.message || 'DATABASE_DELETE_FAILED'
        );
      }
    }

    if (dryRun || oldMessages.length < batchSize) break;
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
    retentionDays: MESSAGE_RETENTION_DAYS,
  };
}

async function cleanupOrphanedMedia() {
  console.log('[Retention] Orphan scan requires B2 bucket inventory; no media was deleted.');
  return { deletedCount: 0 };
}

module.exports = {
  cleanupOldMessages,
  cleanupOrphanedMedia,
  MESSAGE_RETENTION_DAYS,
};
