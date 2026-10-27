import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { isOfflineStorageEnabled, offlineDatabase } from './offlineDatabase';
import { networkStatus } from './networkStatus';
import { logPerformance } from '../utils/performanceLogger';

const COLLECTION = 'reel-video-cache';
const DIRECTORY = `${FileSystem.documentDirectory}reel-videos/`;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_CACHE_BYTES = 150 * 1024 * 1024;
const MAX_CACHE_ITEMS = 3;

let currentDownload = null;
let requestedVideoId = null;

const safeId = id => String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_');

const removeCachedVideo = async record => {
  if (record?.localUri) {
    try {
      await FileSystem.deleteAsync(record.localUri, { idempotent: true });
    } catch (error) {
      console.warn('Could not remove an old cached Reel video:', error.message);
    }
  }
  if (record?.id) await offlineDatabase.deleteRecord(COLLECTION, record.id);
};

const cancelDownload = async download => {
  try {
    await download.task.cancelAsync();
  } catch (error) {
    console.warn('Could not cancel Reel preload:', error.message);
  }
  if (download.done) await download.done.catch(() => {});
  try {
    await FileSystem.deleteAsync(download.destination, { idempotent: true });
  } catch (error) {
    console.warn('Could not remove partial Reel preload:', error.message);
  }
};

const pruneCache = async activeIndex => {
  const records = await offlineDatabase.getCollection(COLLECTION);
  let retainedBytes = 0;
  let retainedItems = 0;
  for (const { key, value } of records) {
    const entry = { ...value, id: key };
    const isCurrentWindow = entry.orderIndex >= activeIndex - 1 &&
      entry.orderIndex <= activeIndex + 1;
    if (!isCurrentWindow || retainedItems >= MAX_CACHE_ITEMS ||
      retainedBytes + Number(entry.size || 0) > MAX_CACHE_BYTES) {
      await removeCachedVideo(entry);
      continue;
    }
    retainedBytes += Number(entry.size || 0);
    retainedItems += 1;
  }
};

export const reelVideoCache = {
  async getPlayableUri(videoId, remoteUri) {
    if (Platform.OS === 'web') return remoteUri || null;
    const id = safeId(videoId);
    if (id) {
      const cached = await offlineDatabase.getRecord(COLLECTION, id);
      if (cached?.remoteUri === remoteUri && cached.localUri) {
        const file = await FileSystem.getInfoAsync(cached.localUri);
        if (file.exists) return cached.localUri;
        await offlineDatabase.deleteRecord(COLLECTION, id);
      }
    }

    await networkStatus.start();
    return networkStatus.get().isOnline ? remoteUri || null : null;
  },

  async preloadNext(reel, activeIndex) {
    if (Platform.OS === 'web' || !reel?.videoUrl || reel._id == null) return;
    const id = safeId(reel._id);
    requestedVideoId = id;
    if (currentDownload && currentDownload.id !== id) {
      const previousDownload = currentDownload;
      currentDownload = null;
      await cancelDownload(previousDownload);
      if (requestedVideoId !== id) return;
    }

    await networkStatus.start();
    if (requestedVideoId !== id) return;
    if (!networkStatus.get().isOnline || !(await isOfflineStorageEnabled())) return;

    await FileSystem.makeDirectoryAsync(DIRECTORY, { intermediates: true });
    if (requestedVideoId !== id) return;
    const cached = await offlineDatabase.getRecord(COLLECTION, id);
    if (cached?.remoteUri === reel.videoUrl && cached.localUri) {
      const file = await FileSystem.getInfoAsync(cached.localUri, { size: true });
      if (file.exists && file.size > 0) {
        await offlineDatabase.putRecord(COLLECTION, id, {
          ...cached,
          orderIndex: activeIndex + 1,
          cachedAt: Date.now(),
        }, { priority: 'high', bytes: file.size });
        await pruneCache(activeIndex);
        return;
      }
      await offlineDatabase.deleteRecord(COLLECTION, id);
    }

    if (currentDownload?.id === id) return;

    const extension = new URL(reel.videoUrl).pathname.match(/\.(mp4|mov|m4v|webm)$/i)?.[1] || 'mp4';
    const destination = `${DIRECTORY}${id}.${extension.toLowerCase()}`;
    const task = FileSystem.createDownloadResumable(
      reel.videoUrl,
      destination,
      {},
      progress => {
        if (progress.totalBytesWritten > MAX_VIDEO_BYTES) {
          task.cancelAsync().catch(error => {
            console.warn('Could not stop oversized Reel preload:', error.message);
          });
        }
      }
    );
    const download = { id, task, destination };
    currentDownload = download;

    try {
      download.done = task.downloadAsync();
      const result = await download.done;
      if (currentDownload !== download || requestedVideoId !== id) {
        await FileSystem.deleteAsync(destination, { idempotent: true });
        return;
      }
      if (!result || result.status < 200 || result.status >= 300) {
        throw new Error(`Reel preload returned HTTP ${result?.status || 'unknown'}`);
      }
      const file = await FileSystem.getInfoAsync(result.uri, { size: true });
      if (!file.exists || !file.size || file.size > MAX_VIDEO_BYTES) {
        throw new Error('Reel preload was empty or exceeded the video size limit.');
      }

      const saved = await offlineDatabase.putRecord(COLLECTION, id, {
        remoteUri: reel.videoUrl,
        localUri: result.uri,
        size: file.size,
        orderIndex: activeIndex + 1,
        cachedAt: Date.now(),
      }, { priority: 'high', bytes: file.size });
      const persisted = saved && await offlineDatabase.getRecord(COLLECTION, id);
      if (!persisted?.localUri) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true });
        return;
      }
      await pruneCache(activeIndex);
      logPerformance(`[Perf] reel-preloaded ${id} ${file.size} bytes`);
    } catch (error) {
      await FileSystem.deleteAsync(destination, { idempotent: true });
      if (requestedVideoId === id) {
        console.warn('Could not preload the next Reel:', error.message);
      }
    } finally {
      if (currentDownload === download) currentDownload = null;
    }
  },

  cancelPreload() {
    requestedVideoId = null;
    const download = currentDownload;
    currentDownload = null;
    if (download) return cancelDownload(download);
  },

  async clear() {
    await this.cancelPreload();
    const records = await offlineDatabase.getCollection(COLLECTION);
    await Promise.all(records.map(({ key, value }) => removeCachedVideo({
      ...value,
      id: key,
    })));
    const directory = await FileSystem.getInfoAsync(DIRECTORY);
    const files = directory.exists ? await FileSystem.readDirectoryAsync(DIRECTORY) : [];
    await Promise.all(files.map(file => FileSystem.deleteAsync(`${DIRECTORY}${file}`, {
      idempotent: true,
    })));
  },
};
