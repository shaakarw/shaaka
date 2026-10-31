import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { offlineDatabase } from './offlineDatabase';
import {
  getBestCachedImage,
  requestImageCache,
  clearImageCache,
} from './imageCache';

const MEDIA_COLLECTION = 'media-cache';
const IMAGE_FIELDS = new Set([
  'image', 'imageUrl', 'thumbnail', 'thumbnailUrl', 'videoThumbnail',
  'avatar', 'userAvatar', 'logo', 'frontImage', 'street', 'streetImage',
  'cover', 'coverImage', 'coverPhoto', 'bannerImage', 'front',
]);
const IMAGE_ARRAY_FIELDS = new Set(['houseImages', 'images', 'imageUrls']);
const isRemote = uri => typeof uri === 'string' && /^https?:\/\//i.test(uri);
const isImage = uri => typeof uri === 'string' && !/\.(mp4|mov|avi|m4v)(\?|$)/i.test(uri);
const keyFor = uri => encodeURIComponent(String(uri)).replace(/%/g, '_').slice(0, 180);

const getLegacyLocalUri = async uri => {
  const record = await offlineDatabase.getRecord(MEDIA_COLLECTION, keyFor(uri));
  if (!record?.localUri) return null;
  const info = await FileSystem.getInfoAsync(record.localUri);
  return info.exists ? record.localUri : null;
};

const getLocalUri = async uri => {
  const cached = await getBestCachedImage([
    ...['original', 'large', 'medium', 'small', 'tiny'].map(quality => ({ uri, quality })),
  ]);
  return cached?.localUri || getLegacyLocalUri(uri);
};

export const mediaCache = {
  async getLocalUri(uri) {
    if (!isRemote(uri) || Platform.OS === 'web') return uri;
    return (await getLocalUri(uri)) || uri;
  },

  async cacheImage(uri, options = {}) {
    if (!isRemote(uri) || !isImage(uri) || Platform.OS === 'web') return uri;
    const existing = await getLocalUri(uri);
    if (existing) return existing;

    const request = requestImageCache(uri, options.quality || 'original');
    try {
      const cached = await request.promise;
      return cached?.localUri || uri;
    } catch (error) {
      console.warn('[Image cache] Image could not be cached:', error.message);
      return uri;
    } finally {
      request.cancel();
    }
  },

  async clearCachedFiles() {
    if (Platform.OS === 'web') return;
    await clearImageCache();
    const records = await offlineDatabase.getCollection(MEDIA_COLLECTION);
    for (const { key, value, protected: isProtected } of records) {
      if (isProtected || !value?.localUri) continue;
      await FileSystem.deleteAsync(value.localUri, { idempotent: true });
      await offlineDatabase.deleteRecord(MEDIA_COLLECTION, key);
    }
  },

  async hydrate(value) {
    if (!value) return value;
    if (Array.isArray(value)) return Promise.all(value.map(item => this.hydrate(item)));
    if (typeof value !== 'object') return value;
    const copy = { ...value };
    for (const [key, item] of Object.entries(copy)) {
      if (typeof item === 'string' && IMAGE_FIELDS.has(key) && isImage(item)) {
        copy[key] = await this.getLocalUri(item);
      } else if (Array.isArray(item)) {
        copy[key] = await Promise.all(item.map(async entry => {
          if (typeof entry === 'string' && IMAGE_ARRAY_FIELDS.has(key) && isImage(entry)) {
            return this.getLocalUri(entry);
          }
          return this.hydrate(entry);
        }));
      } else if (item && typeof item === 'object') {
        copy[key] = await this.hydrate(item);
      }
    }
    return copy;
  },
};
