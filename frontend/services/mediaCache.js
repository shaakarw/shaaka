import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { isOfflineStorageEnabled, offlineDatabase } from './offlineDatabase';

const MEDIA_COLLECTION = 'media-cache';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_FIELDS = new Set([
  'image', 'imageUrl', 'thumbnail', 'thumbnailUrl', 'videoThumbnail',
  'avatar', 'userAvatar', 'logo', 'frontImage', 'street', 'streetImage',
  'cover', 'coverImage', 'coverPhoto', 'bannerImage', 'front',
]);
const IMAGE_ARRAY_FIELDS = new Set(['houseImages', 'images', 'imageUrls']);

const keyFor = uri => encodeURIComponent(String(uri)).replace(/%/g, '_').slice(0, 180);
const isRemote = uri => typeof uri === 'string' && /^https?:\/\//i.test(uri);
const isImage = uri => typeof uri === 'string' && !/\.(mp4|mov|avi|m4v)(\?|$)/i.test(uri);

const localPath = key => `${FileSystem.cacheDirectory}shaaka-${key}`;

export const mediaCache = {
  async getLocalUri(uri) {
    if (!isRemote(uri) || Platform.OS === 'web') return uri;
    const record = await offlineDatabase.getRecord(MEDIA_COLLECTION, keyFor(uri));
    if (!record?.localUri) return uri;
    const info = await FileSystem.getInfoAsync(record.localUri);
    return info.exists ? record.localUri : uri;
  },

  async cacheImage(uri, options = {}) {
    if (!isRemote(uri) || !isImage(uri) || Platform.OS === 'web') return uri;
    if (!(await isOfflineStorageEnabled())) return uri;
    try {
      const key = keyFor(uri);
      const existing = await this.getLocalUri(uri);
      if (existing !== uri) {
        if (options.protected) {
          const cached = await offlineDatabase.getRecord(MEDIA_COLLECTION, key);
          if (cached) {
            await offlineDatabase.putRecord(MEDIA_COLLECTION, key, cached, {
              priority: 'high',
              protected: true,
              bytes: (cached.size || 0) + 512,
            });
          }
        }
        return existing;
      }
      const destination = localPath(key);
      const result = await FileSystem.downloadAsync(uri, destination);
      if (!(await isOfflineStorageEnabled())) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true });
        return uri;
      }
      const info = await FileSystem.getInfoAsync(result.uri, { size: true });
      if (!info.exists || (info.size || 0) > MAX_IMAGE_BYTES) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true });
        return uri;
      }
      await offlineDatabase.putRecord(MEDIA_COLLECTION, key, {
        remoteUri: uri,
        localUri: result.uri,
        size: info.size || 0,
        cachedAt: Date.now(),
      }, {
        priority: options.protected ? 'high' : 'medium',
        protected: !!options.protected,
        bytes: (info.size || 0) + 512,
      });
      return result.uri;
    } catch (error) {
      return uri;
    }
  },

  async clearCachedFiles() {
    if (Platform.OS === 'web') return;
    const records = await offlineDatabase.getCollection(MEDIA_COLLECTION);
    for (const { value, protected: isProtected } of records) {
      if (isProtected || !value?.localUri) continue;
      try {
        await FileSystem.deleteAsync(value.localUri, { idempotent: true });
      } catch {}
    }
  },

  async hydrate(value, options = {}) {
    if (!value) return value;
    if (Array.isArray(value)) return Promise.all(value.map(item => this.hydrate(item, options)));
    if (typeof value !== 'object') return value;
    const copy = { ...value };
    for (const [key, item] of Object.entries(copy)) {
      if (typeof item === 'string' && IMAGE_FIELDS.has(key) && isImage(item)) {
        copy[key] = await this.cacheImage(item, options);
      } else if (Array.isArray(item)) {
        copy[key] = await Promise.all(item.map(entry => (
          typeof entry === 'string' && IMAGE_ARRAY_FIELDS.has(key)
            ? this.cacheImage(entry, options)
            : this.hydrate(entry, options)
        )));
      } else if (item && typeof item === 'object') {
        copy[key] = await this.hydrate(item, options);
      }
    }
    return copy;
  },
};
