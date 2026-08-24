const isVideoUrl = (value) => {
  if (!value || typeof value !== 'string') return false;
  const lower = value.toLowerCase();
  if (lower.includes('video')) return true;
  return /\.(mp4|mov|avi|m4v)(\?.*)?$/i.test(lower);
};

const getMediaItems = (item = {}) => {
  const items = [];
  const explicitVideoUrl = item.videoUrl || item.video || '';

  if (explicitVideoUrl && isVideoUrl(explicitVideoUrl)) {
    items.push({ type: 'video', url: explicitVideoUrl });
  } else if (explicitVideoUrl) {
    items.push({ type: 'image', url: explicitVideoUrl });
  }

  if (Array.isArray(item.houseImages)) {
    item.houseImages.forEach((img) => {
      if (img) {
        items.push({ type: 'image', url: img });
      }
    });
  }

  if (item.imageUrl) {
    items.push({ type: 'image', url: item.imageUrl });
  }

  if (item.images && Array.isArray(item.images)) {
    item.images.forEach((img) => {
      if (img) items.push({ type: 'image', url: img });
    });
  }

  if (items.length === 0 && item.coverImage) {
    items.push({ type: 'image', url: item.coverImage });
  }

  return items.filter((entry) => {
    if (entry.type === 'video') return true;
    const value = entry.url;
    if (typeof value === 'string' && isVideoUrl(value)) {
      return false;
    }
    return true;
  });
};

const getPrimaryMedia = (item = {}) => {
  const explicitVideoUrl = item.videoUrl || item.video || '';
  if (explicitVideoUrl) {
    return { type: 'video', url: explicitVideoUrl };
  }

  const items = getMediaItems(item);
  return items[0] || null;
};

module.exports = {
  getMediaItems,
  getPrimaryMedia,
};
