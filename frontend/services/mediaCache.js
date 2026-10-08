import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { offlineDatabase } from './offlineDatabase';

const MEDIA_COLLECTION = 'media-cache';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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

  async cacheImage(uri) {
    if (!isRemote(uri) || !isImage(uri) || Platform.OS === 'web') return uri;
    try {
      const key = keyFor(uri);
      const existing = await this.getLocalUri(uri);
      if (existing !== uri) return existing;
      const destination = localPath(key);
      const result = await FileSystem.downloadAsync(uri, destination);
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
      }, { priority: 'medium', bytes: (info.size || 0) + 512 });
      return result.uri;
    } catch (error) {
      return uri;
    }
  },

  async hydrate(value) {
    if (!value) return value;
    if (Array.isArray(value)) return Promise.all(value.map(item => this.hydrate(item)));
    if (typeof value !== 'object') return value;
    const copy = { ...value };
    for (const key of ['imageUrl', 'videoThumbnail', 'avatar', 'userAvatar', 'logo', 'frontImage']) {
      if (typeof copy[key] === 'string' && isImage(copy[key])) copy[key] = await this.cacheImage(copy[key]);
    }
    for (const key of ['houseImages', 'images', 'products']) {
      if (Array.isArray(copy[key])) {
        copy[key] = await Promise.all(copy[key].map(item => (
          typeof item === 'string' ? this.cacheImage(item) : this.hydrate(item)
        )));
      }
    }
    return copy;
  },
};
