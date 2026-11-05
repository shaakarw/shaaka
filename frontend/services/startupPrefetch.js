import { getAuthToken } from '../utils/authStorage';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL, LOCAL_LAN_BASE_URLS } from '../constants';
import { networkStatus } from './networkStatus';
import { isOfflineStorageEnabled, offlineDatabase } from './offlineDatabase';
import { mapOfflineCache } from './mapOfflineCache';
import { mediaCache } from './mediaCache';
import { isReelsActive } from './reelActivity';

let running = false;
const listeners = new Set();

const getHeaders = async () => {
  const token = await getAuthToken('userToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const fetchAndCache = async (url, collection, key, options = {}) => {
  const baseUrls = [BASE_URL, ...LOCAL_LAN_BASE_URLS]
    .filter(Boolean)
    .map(value => value.replace(/\/$/, ''))
    .filter((value, index, values) => values.indexOf(value) === index);
  let lastError = null;
  try {
    for (const baseUrl of baseUrls) {
      if (options.shouldSkip?.()) return null;
      try {
        const endpoint = url.replace(BASE_URL, baseUrl);
        const response = await axios.get(endpoint, { headers: options.headers, params: options.params, timeout: 6000 });
        const rawValue = options.pick ? options.pick(response.data) : response.data;
        const value = options.hydrateMedia ? await mediaCache.hydrate(rawValue) : rawValue;
        if (value != null) await offlineDatabase.putRecord(collection, key, value, options.cacheOptions);
        return value;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('No API endpoint available');
  } catch (error) {
    console.warn(`[Shaaka offline cache] ${collection} download failed:`, error?.message || error);
    return null;
  }
};

export const startupPrefetch = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async run(reason = 'app-start') {
    if (isReelsActive()) return { skipped: true, reason: 'reels-active' };
    if (running) return { skipped: true, reason: 'already-running' };
    if (!(await isOfflineStorageEnabled())) return { skipped: true, reason: 'offline-storage-disabled' };
    if (!networkStatus.get().isOnline) {
      listeners.forEach(listener => listener({ status: 'offline', completed: 0, total: 5, reason }));
      return { skipped: true, reason: 'offline' };
    }
    running = true;
    listeners.forEach(listener => listener({ status: 'downloading', completed: 0, total: 3, reason }));
    try {
      const headers = await getHeaders();
      const tasks = [
        fetchAndCache(`${BASE_URL}/api/places`, 'map', 'places', {
          headers, pick: data => data?.places || [], hydrateMedia: true, cacheOptions: { priority: 'medium' },
        }),
        fetchAndCache(`${BASE_URL}/api/messages/conversations`, 'conversations', 'current-user', {
          headers, pick: data => data?.conversations || [], cacheOptions: { priority: 'high', protected: true },
          shouldSkip: isReelsActive,
        }),
        fetchAndCache(`${BASE_URL}/api/notifications`, 'notifications', 'current-user', {
          headers, pick: data => data, cacheOptions: { priority: 'medium' },
        }),
      ];
      let completed = 0;
      const results = await Promise.allSettled(tasks.map((task, index) => task.then(
        value => {
          completed += 1;
          offlineDatabase.getUsage().then(usage => listeners.forEach(listener => listener({ status: 'downloading', completed, total: tasks.length, reason, usage, dataset: ['places', 'conversations', 'notifications'][index] })));
          return value;
        },
        error => {
          completed += 1;
          offlineDatabase.getUsage().then(usage => listeners.forEach(listener => listener({ status: 'downloading', completed, total: tasks.length, reason, usage, dataset: ['places', 'conversations', 'notifications'][index] })));
          throw error;
        }
      )));
      const places = results[0]?.status === 'fulfilled' ? results[0].value : null;
      const downloaded = results.filter(result => result.status === 'fulfilled' && result.value != null).length;
      if (places) await mapOfflineCache.savePlaces(places);
      await offlineDatabase.evict();
      listeners.forEach(listener => listener({ status: 'complete', completed: results.length, total: results.length, downloaded, reason }));
      return { skipped: false, downloaded };
    } finally {
      running = false;
    }
  },
};
