import AsyncStorage from '@react-native-async-storage/async-storage';

export const OFFLINE_CACHE_LIMIT_BYTES = 300 * 1024 * 1024;
const LEDGER_KEY = '@shaaka/offline-cache-ledger-v1';
const DATA_PREFIX = '@shaaka/offline-data/';

const priorityRank = { low: 0, medium: 1, high: 2 };

const readLedger = async () => {
  try {
    const value = await AsyncStorage.getItem(LEDGER_KEY);
    return value ? JSON.parse(value) : { entries: {}, totalBytes: 0 };
  } catch (error) {
    return { entries: {}, totalBytes: 0 };
  }
};

const writeLedger = ledger => AsyncStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
const estimateBytes = value => new Blob([JSON.stringify(value)]).size;

const evictUntilFits = async (ledger, requiredBytes) => {
  const target = OFFLINE_CACHE_LIMIT_BYTES - requiredBytes;
  const candidates = Object.values(ledger.entries)
    .filter(entry => !entry.protected)
    .sort((first, second) => (
      priorityRank[first.priority] - priorityRank[second.priority]
      || first.lastAccessedAt - second.lastAccessedAt
    ));

  for (const entry of candidates) {
    if (ledger.totalBytes <= target) break;
    await AsyncStorage.removeItem(`${DATA_PREFIX}${entry.key}`);
    ledger.totalBytes -= entry.bytes;
    delete ledger.entries[entry.key];
  }
};

export const offlineStorage = {
  async get(key) {
    const value = await AsyncStorage.getItem(`${DATA_PREFIX}${key}`);
    if (value == null) return null;
    const ledger = await readLedger();
    if (ledger.entries[key]) {
      ledger.entries[key].lastAccessedAt = Date.now();
      await writeLedger(ledger);
    }
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  },

  async set(key, value, options = {}) {
    const serialized = JSON.stringify(value);
    const bytes = new Blob([serialized]).size;
    if (bytes > OFFLINE_CACHE_LIMIT_BYTES && !options.protected) {
      throw new Error('Offline cache item exceeds the 300 MB limit');
    }

    const ledger = await readLedger();
    const previous = ledger.entries[key];
    if (previous) ledger.totalBytes -= previous.bytes;
    await evictUntilFits(ledger, bytes);

    if (ledger.totalBytes + bytes > OFFLINE_CACHE_LIMIT_BYTES && !options.protected) {
      if (previous) ledger.totalBytes += previous.bytes;
      return false;
    }

    await AsyncStorage.setItem(`${DATA_PREFIX}${key}`, serialized);
    ledger.entries[key] = {
      key,
      bytes,
      priority: options.priority || 'medium',
      protected: !!options.protected,
      lastAccessedAt: Date.now(),
      updatedAt: Date.now(),
    };
    ledger.totalBytes += bytes;
    await writeLedger(ledger);
    return true;
  },

  async remove(key) {
    const ledger = await readLedger();
    const entry = ledger.entries[key];
    await AsyncStorage.removeItem(`${DATA_PREFIX}${key}`);
    if (entry) {
      ledger.totalBytes = Math.max(0, ledger.totalBytes - entry.bytes);
      delete ledger.entries[key];
      await writeLedger(ledger);
    }
  },

  async getUsage() {
    const ledger = await readLedger();
    return {
      usedBytes: Math.max(0, ledger.totalBytes),
      limitBytes: OFFLINE_CACHE_LIMIT_BYTES,
      entries: Object.values(ledger.entries),
    };
  },

  async cleanup() {
    const ledger = await readLedger();
    await evictUntilFits(ledger, 0);
    await writeLedger(ledger);
  },
};

export const offlineDataKey = (scope, key) => `${scope}:${key}`;
