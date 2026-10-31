import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';

const CACHE_DIRECTORY = `${FileSystem.documentDirectory}video-backgrounds/`;
const CACHE_INDEX_KEY = '@shaaka/video-background-cache';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CACHE_BYTES = 100 * 1024 * 1024;
const pendingJobs = new Map();
let generationQueue = Promise.resolve();

const hashKey = value => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const calculateBackgroundDuration = ({
  duration = 0,
  width = 0,
  height = 0,
  size = 0,
} = {}) => {
  const seconds = Number(duration);
  if (!Number.isFinite(seconds) || seconds <= 0) return 2.5;
  if (seconds < 0.6) return Math.max(0.2, seconds * 0.6);

  let target;
  if (seconds <= 4) target = seconds / 3;
  else if (seconds <= 12) target = 1 + (seconds - 4) * 0.25;
  else if (seconds <= 30) target = 3;
  else target = Math.min(5, 3 + (seconds - 30) * (2 / 30));

  const pixelCount = Number(width) * Number(height);
  if (Number(width) > 100 && Number(height) > 100 && pixelCount < 640 * 360) target *= 0.85;
  if (Number(size) > 100 * 1024 * 1024) target *= 0.8;
  return Math.max(0.25, Math.min(5, target));
};

const readIndex = async () => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_INDEX_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn('Could not read the video background cache index:', error.name || 'Unknown error');
    return {};
  }
};

const writeIndex = async index => {
  try {
    await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
    return true;
  } catch (error) {
    console.warn('Could not save the video background cache index:', error.name || 'Unknown error');
    return false;
  }
};

const fileExists = async uri => {
  if (!uri) return false;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch (error) {
    console.warn('Could not check a cached video background:', error.name || 'Unknown error');
    return false;
  }
};

const pruneCache = async index => {
  const now = Date.now();
  const entries = Object.entries(index)
    .map(([key, value]) => ({ key, ...value }))
    .sort((first, second) => Number(second.lastUsedAt) - Number(first.lastUsedAt));
  let retainedBytes = 0;
  const retained = {};

  for (const entry of entries) {
    const expired = now - Number(entry.createdAt || 0) > CACHE_TTL_MS;
    const tooLarge = retainedBytes + Number(entry.size || 0) > MAX_CACHE_BYTES;
    if (expired || tooLarge) {
      if (entry.frameUri && !/^https?:\/\//i.test(entry.frameUri)) {
        try {
          await FileSystem.deleteAsync(entry.frameUri, { idempotent: true });
        } catch (error) {
          console.warn('Could not remove an expired video background frame:', error.name || 'Unknown error');
        }
      }
      continue;
    }
    retained[entry.key] = entry;
    retainedBytes += Number(entry.size || 0);
  }

  await writeIndex(retained);
  return retained;
};

const getFrame = async (uri, duration, fallbackUri) => {
  const time = Math.max(0, Math.min(Number(duration) * 0.35 || 1, 3));
  try {
    const thumbnail = await VideoThumbnails.getThumbnailAsync(uri, {
      time: Math.round(time * 1000),
      quality: 0.72,
    });
    return thumbnail.uri;
  } catch (firstError) {
    try {
      const thumbnail = await VideoThumbnails.getThumbnailAsync(uri, {
        time: 0,
        quality: 0.55,
      });
      return thumbnail.uri;
    } catch (secondError) {
      console.warn('Could not extract a video background frame:', secondError.name || firstError.name || 'Unknown error');
      return fallbackUri || null;
    }
  }
};

const createBackground = async (key, uri, metadata, fallbackFrame) => {
  if (Platform.OS === 'web') {
    return {
      frameUri: fallbackFrame || null,
      duration: calculateBackgroundDuration(metadata),
    };
  }

  await FileSystem.makeDirectoryAsync(CACHE_DIRECTORY, { intermediates: true });
  const frameUri = await getFrame(uri, metadata.duration, fallbackFrame);
  const framePath = frameUri
    ? `${CACHE_DIRECTORY}${key}-frame${frameUri.toLowerCase().includes('.png') ? '.png' : '.jpg'}`
    : null;
  let storedFrameUri = frameUri;

  if (frameUri && framePath && frameUri !== framePath) {
    try {
      await FileSystem.deleteAsync(framePath, { idempotent: true });
      if (/^https?:\/\//i.test(frameUri)) {
        await FileSystem.downloadAsync(frameUri, framePath);
      } else {
        await FileSystem.copyAsync({ from: frameUri, to: framePath });
      }
      storedFrameUri = framePath;
    } catch (error) {
      console.warn('Could not cache the extracted video background frame:', error.name || 'Unknown error');
    }
  }

  let frameSize = 0;
  if (storedFrameUri && !/^https?:\/\//i.test(storedFrameUri)) {
    try {
      const frameInfo = await FileSystem.getInfoAsync(storedFrameUri, { size: true });
      frameSize = Number(frameInfo.size) || 0;
    } catch (error) {
      console.warn('Could not determine the cached video background size:', error.name || 'Unknown error');
    }
  }

  const duration = calculateBackgroundDuration(metadata);
  const index = await readIndex();
  index[key] = {
    frameUri: storedFrameUri,
    duration,
    size: frameSize,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    failedUntil: frameSize > 0 ? 0 : Date.now() + 24 * 60 * 60 * 1000,
  };
  await pruneCache(index);
  return { frameUri: storedFrameUri, duration };
};

export const requestVideoBackground = async ({
  uri,
  cacheKey,
  duration = 0,
  width = 0,
  height = 0,
  size = 0,
  thumbnailUri,
} = {}) => {
  if (!uri) return { frameUri: thumbnailUri || null, duration: calculateBackgroundDuration({ duration }) };
  const key = hashKey(String(cacheKey || uri));
  const index = await readIndex();
  const cached = index[key];
  if (cached && Date.now() - Number(cached.createdAt || 0) <= CACHE_TTL_MS) {
    const frameIsValid = await fileExists(cached.frameUri);
    if (frameIsValid) {
      cached.lastUsedAt = Date.now();
      await writeIndex(index);
      return {
        frameUri: cached.frameUri,
        duration: cached.duration || calculateBackgroundDuration({ duration }),
      };
    }
    if (Number(cached.failedUntil) > Date.now()) {
      return {
        frameUri: thumbnailUri || null,
        duration: cached.duration || calculateBackgroundDuration({ duration }),
      };
    }
  }

  if (pendingJobs.has(key)) return pendingJobs.get(key);
  const metadata = {
    duration,
    width,
    height,
    size,
  };
  const task = generationQueue.then(() => createBackground(
    key,
    uri,
    metadata,
    thumbnailUri,
  ));
  generationQueue = task.catch(error => {
    console.warn('Video background generation job failed:', error.name || 'Unknown error');
  });
  pendingJobs.set(key, task);
  task.then(
    () => pendingJobs.delete(key),
    () => pendingJobs.delete(key),
  );
  return task;
};
