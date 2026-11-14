const Message = require('../models/Message');
const { getClient } = require('../config/db');
const storageService = require('../services/storage/storageService');

const recordUploadedMessageImages = async (userId, storageKeys, uploadedAt = new Date()) => {
  const database = getClient();
  for (const storageKey of [...new Set(storageKeys.filter(storageService.isStorageKey))]) {
    await database.execute({
      sql: `
        INSERT INTO message_image_uploads (user_id, storage_key, uploaded_at)
        VALUES (?, ?, ?)
        ON CONFLICT (storage_key) DO UPDATE
        SET user_id = excluded.user_id, message_id = NULL, uploaded_at = excluded.uploaded_at
      `,
      args: [String(userId), storageKey, uploadedAt.toISOString()],
    });
  }
};

const attachMessageImages = async (userId, messageId, storageKeys) => {
  const keys = [...new Set(storageKeys.filter(storageService.isStorageKey))];
  if (!keys.length) return;
  await getClient().execute({
    sql: `
      UPDATE message_image_uploads
      SET message_id = ?
      WHERE user_id = ? AND storage_key IN (${keys.map(() => '?').join(', ')})
    `,
    args: [String(messageId), String(userId), ...keys],
  });
};

const removeUploadedMessageImages = async storageKeys => {
  const keys = [...new Set(storageKeys.filter(storageService.isStorageKey))];
  if (!keys.length) return;
  await getClient().execute({
    sql: `DELETE FROM message_image_uploads WHERE storage_key IN (${keys.map(() => '?').join(', ')})`,
    args: keys,
  });
};

const removeImageReferenceFromMessage = async (messageId, storageKey) => {
  const message = await Message.findById(messageId);
  if (!message) return;

  const imageUrls = Array.isArray(message.imageUrls) && message.imageUrls.length
    ? message.imageUrls
    : (message.imageUrl ? [message.imageUrl] : []);
  const imageStorageKeys = imageUrls.map((url, index) => (
    message.imageStorageKeys?.[index]
    || storageService.getStorageKeyFromUrl(url)
    || (index === 0 ? message.imageStorageKey : '')
  ));
  const retainedImages = imageUrls
    .map((url, index) => ({ url, key: imageStorageKeys[index] }))
    .filter(image => image.key !== storageKey);
  if (retainedImages.length === imageUrls.length) return;

  await Message.findByIdAndUpdate(messageId, {
    $set: {
      imageUrl: retainedImages[0]?.url || '',
      imageUrls: retainedImages.length > 1 ? retainedImages.map(image => image.url) : [],
      imageStorageKey: retainedImages[0]?.key || '',
      imageStorageKeys: retainedImages.map(image => image.key || ''),
    },
  });
};

module.exports = {
  attachMessageImages,
  recordUploadedMessageImages,
  removeImageReferenceFromMessage,
  removeUploadedMessageImages,
};
