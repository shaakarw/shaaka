import { Image, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { isOfflineStorageEnabled } from './offlineDatabase';

const SQLite = Platform.OS === 'web' ? null : require('expo-sqlite');
export const IMAGE_CACHE_LIMIT_BYTES = 500 * 1024 * 1024;
const DB_NAME = 'shaaka-images.db';
const IMAGE_DIRECTORY = `${FileSystem.documentDirectory || ''}shaaka-images/`;
const IMAGE_SIZE_LIMIT = 12 * 1024 * 1024;
const downloads = new Map();
let databasePromise;
let databaseOperationQueue = Promise.resolve();

const serializeDatabaseOperation = operation => {
  const result = databaseOperationQueue.then(operation, operation);
  databaseOperationQueue = result.catch(() => {});
  return result;
};

const getFirstAsync = (db, ...args) => (
  serializeDatabaseOperation(() => db.getFirstAsync(...args))
);

const getAllAsync = (db, ...args) => (
  serializeDatabaseOperation(() => db.getAllAsync(...args))
);

const runAsync = (db, ...args) => (
  serializeDatabaseOperation(() => db.runAsync(...args))
);

const hash = value => {
  let first = 2166136261;
  let second = 5381;
  for (let index = 0; index < value.length; index += 1) {
    first = Math.imul(first ^ value.charCodeAt(index), 16777619);
    second = Math.imul(second, 33) ^ value.charCodeAt(index);
  }
  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`;
};

const cacheKeyFor = (uri, quality) => `${hash(uri)}-${quality}`;
const isRemoteUri = uri => typeof uri === 'string' && /^https?:\/\//i.test(uri);

const verifyDecodedImage = uri => new Promise((resolve, reject) => {
  Image.getSize(
    uri,
    (width, height) => {
      if (width > 0 && height > 0) resolve({ width, height });
      else reject(new Error('Downloaded image has invalid dimensions.'));
    },
    error => reject(new Error(`Downloaded image could not be decoded: ${error.message}`))
  );
});

const getDatabase = async () => {
  if (!SQLite) return null;
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DB_NAME).then(async db => {
        await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 5000;
        PRAGMA synchronous = NORMAL;
        CREATE TABLE IF NOT EXISTS image_cache (
            cache_key TEXT PRIMARY KEY NOT NULL,
            remote_uri TEXT NOT NULL,
            quality TEXT NOT NULL,
            local_uri TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            accessed_at INTEGER NOT NULL
          );
          CREATE INDEX IF NOT EXISTS image_cache_lru ON image_cache(accessed_at);
        `);
        return db;
      }).catch(error => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
};

const readRecord = async (uri, quality) => {
  const db = await getDatabase();
  if (!db) return null;
  const cacheKey = cacheKeyFor(uri, quality);
  const record = await getFirstAsync(db,
    'SELECT cache_key, remote_uri, quality, local_uri, file_size FROM image_cache WHERE cache_key = ?',
    cacheKey
  );
  if (!record || record.remote_uri !== uri) return null;
  const info = await FileSystem.getInfoAsync(record.local_uri, { size: true });
  if (!info.exists || !info.size || info.size !== record.file_size) {
    await FileSystem.deleteAsync(record.local_uri, { idempotent: true });
    await runAsync(db, 'DELETE FROM image_cache WHERE cache_key = ?', cacheKey);
    return null;
  }
  await runAsync(db, 'UPDATE image_cache SET accessed_at = ? WHERE cache_key = ?', Date.now(), cacheKey);
  return { ...record, localUri: record.local_uri, fileSize: record.file_size };
};

export const getCachedImage = async (uri, quality) => {
  if (!isRemoteUri(uri) || Platform.OS === 'web') return null;
  return readRecord(uri, quality);
};

export const getBestCachedImage = async candidates => {
  for (const candidate of candidates) {
    const record = await getCachedImage(candidate.uri, candidate.quality);
    if (record) return record;
  }
  return null;
};

const getCacheUsage = async db => {
  const result = await getFirstAsync(db, 'SELECT COALESCE(SUM(file_size), 0) AS total FROM image_cache');
  return Number(result?.total || 0);
};

const evictToLimit = async db => {
  let usedBytes = await getCacheUsage(db);
  if (usedBytes <= IMAGE_CACHE_LIMIT_BYTES) return;
  const rows = await getAllAsync(db, 'SELECT cache_key, local_uri, file_size FROM image_cache ORDER BY accessed_at ASC');
  for (const row of rows) {
    if (usedBytes <= IMAGE_CACHE_LIMIT_BYTES) break;
    await FileSystem.deleteAsync(row.local_uri, { idempotent: true });
    await runAsync(db, 'DELETE FROM image_cache WHERE cache_key = ?', row.cache_key);
    usedBytes -= row.file_size;
  }
};

const downloadAndStore = (uri, quality, cacheKey, headers) => {
  const task = FileSystem.createDownloadResumable(
    uri,
    `${IMAGE_DIRECTORY}${cacheKey}.download`,
    headers ? { headers } : undefined
  );
  const pending = { task, consumers: 0, promise: null };
  pending.promise = (async () => {
    const db = await getDatabase();
    if (!db || !(await isOfflineStorageEnabled())) return null;
    if (pending.consumers === 0) return null;
    const existing = await readRecord(uri, quality);
    if (existing) return existing;
    await FileSystem.makeDirectoryAsync(IMAGE_DIRECTORY, { intermediates: true });
    const extension = /\.webp(?:[?#]|$)/i.test(uri) ? 'webp' : 'image';
    const finalUri = `${IMAGE_DIRECTORY}${cacheKey}.${extension}`;
    const tempUri = `${IMAGE_DIRECTORY}${cacheKey}.download`;
    try {
      await FileSystem.deleteAsync(finalUri, { idempotent: true });
      const result = await task.downloadAsync();
      if (!result || result.status < 200 || result.status >= 300) {
        throw new Error(`Image download returned HTTP ${result?.status || 'unknown'}.`);
      }
      const contentType = String(result.headers?.['Content-Type'] || result.headers?.['content-type'] || '');
      if (contentType && !contentType.toLowerCase().startsWith('image/')) {
        throw new Error(`Image download returned an unexpected content type: ${contentType}.`);
      }
      if (!(await isOfflineStorageEnabled())) {
        await FileSystem.deleteAsync(tempUri, { idempotent: true });
        return null;
      }
      const info = await FileSystem.getInfoAsync(result.uri, { size: true });
      if (!info.exists || !info.size || info.size > IMAGE_SIZE_LIMIT) {
        throw new Error('Downloaded image is empty or exceeds the cache file-size limit.');
      }
      await FileSystem.moveAsync({ from: result.uri, to: finalUri });
      const verified = await FileSystem.getInfoAsync(finalUri, { size: true });
      if (!verified.exists || verified.size !== info.size) {
        throw new Error('Downloaded image failed local file verification.');
      }
      await verifyDecodedImage(finalUri);
      const now = Date.now();
      await runAsync(db,
        `INSERT OR REPLACE INTO image_cache
          (cache_key, remote_uri, quality, local_uri, file_size, created_at, accessed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        cacheKey, uri, quality, finalUri, verified.size, now, now
      );
      await evictToLimit(db);
      return { localUri: finalUri, fileSize: verified.size, quality };
    } catch (error) {
      await FileSystem.deleteAsync(tempUri, { idempotent: true });
      await FileSystem.deleteAsync(finalUri, { idempotent: true });
      throw error;
    }
  })().finally(() => {
    if (downloads.get(cacheKey) === pending) downloads.delete(cacheKey);
  });
  downloads.set(cacheKey, pending);
  return pending;
};

export const requestImageCache = (uri, quality = 'original', options = {}) => {
  if (!isRemoteUri(uri) || Platform.OS === 'web') {
    return { promise: Promise.resolve(null), cancel: () => {} };
  }
  const cacheKey = cacheKeyFor(uri, quality);
  let pending = downloads.get(cacheKey);
  if (!pending) {
    pending = downloadAndStore(uri, quality, cacheKey, options.headers);
    if (!pending) return { promise: Promise.resolve(null), cancel: () => {} };
  }
  pending.consumers += 1;
  let cancelled = false;
  return {
    promise: pending.promise,
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      pending.consumers = Math.max(0, pending.consumers - 1);
      if (pending.consumers === 0 && downloads.get(cacheKey) === pending) {
        pending.task.cancelAsync().catch(error => {
          console.warn('[Image cache] Could not cancel an unused image download:', error.message);
        });
      }
    },
  };
};

export const clearImageCache = async () => {
  if (Platform.OS === 'web') return;
  const db = await getDatabase();
  if (!db) return;
  const records = await getAllAsync(db, 'SELECT cache_key, local_uri FROM image_cache');
  for (const record of records) {
    await FileSystem.deleteAsync(record.local_uri, { idempotent: true });
    await runAsync(db, 'DELETE FROM image_cache WHERE cache_key = ?', record.cache_key);
  }
};

export const getImageCacheUsage = async () => {
  const db = await getDatabase();
  if (!db) return { usedBytes: 0, limitBytes: IMAGE_CACHE_LIMIT_BYTES };
  return { usedBytes: await getCacheUsage(db), limitBytes: IMAGE_CACHE_LIMIT_BYTES };
};
