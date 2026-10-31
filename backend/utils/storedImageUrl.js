const isDeviceLocalUri = value => (
  typeof value === 'string' && /^(?:file|content|asset):/i.test(value.trim())
);

const resolveStoredImageUrl = (imageUrl, storageKey, storageService) => {
  if (!isDeviceLocalUri(imageUrl) || !storageService?.isStorageKey?.(storageKey)) {
    return imageUrl;
  }
  return storageService.getMediaUrl(storageKey);
};

module.exports = { resolveStoredImageUrl };
