const storageService = require('./storage/storageService');
const { createImageVariants } = require('./imageProcessing');

async function uploadImageWithVariants({ buffer, mimeType, folder, maxBytes, origin }) {
  const original = await storageService.uploadMedia({ buffer, mimeType, folder, maxBytes });
  const originalUrl = storageService.getMediaUrl(original.storageKey, { origin });
  const uploadedVariantKeys = [];
  let width = 0;
  let height = 0;
  const variants = {};

  try {
    const processed = await createImageVariants(buffer);
    width = processed.width;
    height = processed.height;
    for (const [quality, variant] of Object.entries(processed.variants)) {
      const uploaded = await storageService.uploadMedia({
        buffer: variant.buffer,
        mimeType: variant.mimeType,
        folder: `${folder}/variants`,
        maxBytes,
      });
      uploadedVariantKeys.push(uploaded.storageKey);
      variants[quality] = {
        url: storageService.getMediaUrl(uploaded.storageKey, { origin }),
        storageKey: uploaded.storageKey,
        width: variant.width,
        height: variant.height,
        fileSize: uploaded.fileSize,
      };
    }
  } catch (error) {
    await Promise.all(uploadedVariantKeys.map(key => storageService.deleteMedia(key).catch(deleteError => {
      console.error('[Storage] Failed to clean up an incomplete image variant:', deleteError.code || 'B2_OPERATION_FAILED');
    })));
    uploadedVariantKeys.length = 0;
    Object.keys(variants).forEach(key => delete variants[key]);
    console.warn('[Image upload] Variants could not be generated; preserving the original image.', error.message);
  }

  return {
    original,
    originalUrl,
    storageKeys: [original.storageKey, ...uploadedVariantKeys],
    imageVariants: {
      originalUrl,
      originalStorageKey: original.storageKey,
      width,
      height,
      variants,
    },
  };
}

module.exports = { uploadImageWithVariants };
