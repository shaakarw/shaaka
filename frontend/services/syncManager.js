import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../constants';
import { networkStatus } from './networkStatus';
import { offlineDatabase } from './offlineDatabase';

let running = false;
const listeners = new Set();

const authConfig = async () => {
  const token = await AsyncStorage.getItem('userToken');
  return token ? { headers: { Authorization: `Bearer ${token}` } } : null;
};

const processAction = async action => {
  const config = await authConfig();
  if (!config) throw new Error('Authentication required');
  switch (action.actionType) {
    case 'SEND_MESSAGE':
      return axios.post(`${BASE_URL}/api/messages/send`, action.payload, config);
    default:
      throw new Error(`Unsupported offline action: ${action.actionType}`);
  }
};

const pullChanges = async () => {
  const config = await authConfig();
  if (!config) return;
  const since = Number(await offlineDatabase.getMetadata('lastSyncTimestamp')) || 0;
  const response = await axios.get(`${BASE_URL}/api/sync/pull?since=${since}`, config);
  for (const message of response.data.messages || []) {
    await offlineDatabase.putRecord('messages', message._id, message, { priority: 'high', protected: true });
  }
  for (const post of response.data.posts || []) {
    await offlineDatabase.putRecord('posts', post._id, post, { priority: 'medium' });
  }
  await offlineDatabase.setMetadata('lastSyncTimestamp', response.data.serverTimestamp || Date.now());
};

export const syncManager = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async run(reason = 'manual') {
    if (running || !networkStatus.get().isOnline) return { skipped: true, reason };
    running = true;
    listeners.forEach(listener => listener({ status: 'syncing', reason }));
    let synced = 0;
    try {
      for (const action of await offlineDatabase.getDueActions()) {
        if (!networkStatus.get().isOnline) break;
        try {
          const response = await processAction(action);
          if (action.actionType === 'SEND_MESSAGE' && response?.data?.message) {
            await offlineDatabase.putRecord('messages', response.data.message._id, response.data.message, { priority: 'high', protected: true });
          }
          await offlineDatabase.completeAction(action.id);
          synced += 1;
        } catch (error) {
          await offlineDatabase.deferAction(action, error);
        }
      }
      await pullChanges();
      await offlineDatabase.evict();
      listeners.forEach(listener => listener({ status: 'complete', synced }));
      return { synced };
    } finally {
      running = false;
    }
  },

  async enqueue(action) {
    const item = await offlineDatabase.enqueue(action);
    if (networkStatus.get().isOnline) this.run('queued-action');
    return item;
  },
};
