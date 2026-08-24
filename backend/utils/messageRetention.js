// backend/utils/messageRetention.js
// Utility to clean up old messages and Cloudinary assets based on user retention settings

const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');

const CLOUDINARY_HOSTNAME = 'res.cloudinary.com';

function isCloudinaryUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.toLowerCase().includes(CLOUDINARY_HOSTNAME);
}

function parseCloudinaryPublicId(url) {
  if (!isCloudinaryUrl(url)) return null;
  const normalized = String(url).trim();
  const match = normalized.match(/\/\w+\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?(?:\?.*)?$/);
  if (!match || !match[1]) return null;
  const lower = normalized.toLowerCase();
  const resourceType = lower.includes('/video/') || lower.includes('/video/upload') ? 'video' : 'image';
  return { publicId: match[1], resourceType };
}

async function deleteCloudinaryAsset(publicId, resourceType = 'image') {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType === 'video' ? 'video' : 'image',
    });
    if (result && result.result !== 'ok' && result.result !== 'not found') {
      console.warn('[Retention] Cloudinary non-ok result:', result.result, 'for', publicId);
    }
    return result;
  } catch (error) {
    console.error('[Retention] Cloudinary delete failed for', publicId, ':', error.message);
    return null;
  }
}

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
      const publicIds = [];
      for (const msg of oldImageMessages) {
        if (msg.cloudinaryPublicId && isCloudinaryUrl(msg.imageUrl || msg.videoUrl || '')) {
          const resourceType = msg.cloudinaryResourceType || (msg.videoUrl && isCloudinaryUrl(msg.videoUrl) ? 'video' : 'image');
          publicIds.push({ publicId: msg.cloudinaryPublicId, resourceType });
        }
      }

      if (!dryRun) {
        for (const { publicId, resourceType } of publicIds) {
          const result = await deleteCloudinaryAsset(publicId, resourceType);
          if (result && (result.result === 'ok' || result.result === 'not found')) {
            totalAssetsDeleted++;
          } else {
            totalAssetsFailed++;
          }
        }
      } else {
        totalAssetsDeleted += publicIds.length;
      }

      const messageIds = oldImageMessages.map(m => m._id);
      if (!dryRun) {
        await Message.deleteMany({ _id: { $in: messageIds } });
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
  console.log('[Retention] Starting orphaned media cleanup');
  let deletedCount = 0;

  const messagesWithMedia = await Message.find({
    $or: [
      { imageUrl: { $exists: true, $ne: '' } },
      { videoUrl: { $exists: true, $ne: '' } },
      { audioUrl: { $exists: true, $ne: '' } },
    ],
  }).select('cloudinaryPublicId cloudinaryResourceType imageUrl videoUrl audioUrl').lean();

  for (const msg of messagesWithMedia) {
    const publicId = msg.cloudinaryPublicId || '';
    if (!publicId) continue;

    const hasUrl = isCloudinaryUrl(msg.imageUrl || msg.videoUrl || msg.audioUrl || '');
    if (!hasUrl) continue;

    const resourceType = msg.cloudinaryResourceType || (msg.videoUrl && isCloudinaryUrl(msg.videoUrl) ? 'video' : 'image');
    const result = await deleteCloudinaryAsset(publicId, resourceType);
    if (result && (result.result === 'ok' || result.result === 'not found')) {
      deletedCount++;
    }
  }

  console.log(`[Retention] Orphaned media cleanup complete. Assets deleted: ${deletedCount}`);
  return { deletedCount };
}

module.exports = {
  cleanupOldMessages,
  cleanupOrphanedMedia,
  deleteCloudinaryAsset,
  parseCloudinaryPublicId,
  isCloudinaryUrl,
};
