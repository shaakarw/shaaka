import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SQLite = Platform.OS === 'web' ? null : require('expo-sqlite');

const DB_NAME = 'shaaka-offline.db';
const FALLBACK_PREFIX = '@shaaka/offline-db/';
const LIMIT_BYTES = 300 * 1024 * 1024;
const FALLBACK_LEDGER_KEY = `${FALLBACK_PREFIX}ledger`;
let databasePromise;
const usageListeners = new Set();

const timestamp = () => Date.now();
const sizeOf = value => {
  const serialized = JSON.stringify(value);
  if (typeof Blob !== 'undefined') return new Blob([serialized]).size;
  return serialized.length * 2;
};
const priorityValue = priority => ({ low: 0, medium: 1, high: 2 }[priority] ?? 1);
const fallbackKey = key => `${FALLBACK_PREFIX}${key}`;

const getDatabase = async () => {
  if (!SQLite) return null;
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DB_NAME).then(async db => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS records (
          key TEXT PRIMARY KEY NOT NULL, collection TEXT NOT NULL, value TEXT NOT NULL,
          bytes INTEGER NOT NULL DEFAULT 0, priority INTEGER NOT NULL DEFAULT 1,
          protected INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, accessed_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sync_queue (
          id TEXT PRIMARY KEY NOT NULL, action_type TEXT NOT NULL, entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'pending', last_error TEXT
        );
        CREATE INDEX IF NOT EXISTS sync_queue_due ON sync_queue(status, next_attempt_at);
        CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT);
      `);
      return db;
    }).catch(() => null);
  }
  return databasePromise;
};

const fallbackRead = async key => {
  const value = await AsyncStorage.getItem(fallbackKey(key));
  return value == null ? null : JSON.parse(value);
};

const fallbackLedger = async () => (await fallbackRead('ledger')) || { entries: {} };
const saveFallbackLedger = ledger => AsyncStorage.setItem(FALLBACK_LEDGER_KEY, JSON.stringify(ledger));

export const offlineDatabase = {
  subscribeUsage(listener) {
    usageListeners.add(listener);
    return () => usageListeners.delete(listener);
  },

  async getRecord(collection, key) {
    const db = await getDatabase();
    const recordKey = `${collection}:${key}`;
    if (!db) return fallbackRead(recordKey);
    const row = await db.getFirstAsync('SELECT value FROM records WHERE key = ?', recordKey);
    if (!row) return null;
    await db.runAsync('UPDATE records SET accessed_at = ? WHERE key = ?', timestamp(), recordKey);
    return JSON.parse(row.value);
  },

  async putRecord(collection, key, value, options = {}) {
    const db = await getDatabase();
    const recordKey = `${collection}:${key}`;
    if (!db) {
      const ledger = await fallbackLedger();
      const bytes = Number(options.bytes) || sizeOf(value);
      ledger.entries[recordKey] = {
        key: recordKey, collection, bytes, priority: priorityValue(options.priority),
        protected: !!options.protected, updatedAt: timestamp(), accessedAt: timestamp(),
      };
      await AsyncStorage.setItem(fallbackKey(recordKey), JSON.stringify(value));
      const usage = Object.values(ledger.entries).reduce((total, entry) => total + entry.bytes, 0);
      let nextUsage = usage;
      if (usage > LIMIT_BYTES) {
        const candidates = Object.values(ledger.entries)
          .filter(entry => !entry.protected && entry.key !== recordKey)
          .sort((first, second) => first.priority - second.priority || first.accessedAt - second.accessedAt);
        for (const entry of candidates) {
          if (nextUsage <= LIMIT_BYTES) break;
          await AsyncStorage.removeItem(fallbackKey(entry.key));
          delete ledger.entries[entry.key];
          nextUsage -= entry.bytes;
        }
        if (nextUsage > LIMIT_BYTES && !options.protected) {
          delete ledger.entries[recordKey];
          await AsyncStorage.removeItem(fallbackKey(recordKey));
          await saveFallbackLedger(ledger);
          return false;
        }
      }
      await saveFallbackLedger(ledger);
      usageListeners.forEach(listener => listener({ usedBytes: Math.min(nextUsage, LIMIT_BYTES), limitBytes: LIMIT_BYTES }));
      return true;
    }
    const existing = await db.getFirstAsync('SELECT bytes FROM records WHERE key = ?', recordKey);
    const bytes = Number(options.bytes) || sizeOf(value);
    const usage = await this.getUsage();
    const availableAfterReplacement = usage.usedBytes - Number(existing?.bytes || 0) + bytes;
    if (availableAfterReplacement > LIMIT_BYTES) {
      await this.evict(LIMIT_BYTES - bytes + Number(existing?.bytes || 0));
      const afterEviction = await this.getUsage();
      if (afterEviction.usedBytes - Number(existing?.bytes || 0) + bytes > LIMIT_BYTES) return false;
    }
    const time = timestamp();
    await db.runAsync(
      `INSERT INTO records(key, collection, value, bytes, priority, protected, updated_at, accessed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, bytes=excluded.bytes,
       priority=excluded.priority, protected=excluded.protected, updated_at=excluded.updated_at,
       accessed_at=excluded.accessed_at`,
      recordKey, collection, JSON.stringify(value), bytes, priorityValue(options.priority),
      options.protected ? 1 : 0, time, time
    );
    await this.evict();
    const usageAfterWrite = await this.getUsage();
    usageListeners.forEach(listener => listener(usageAfterWrite));
    return true;
  },

  async deleteRecord(collection, key) {
    const db = await getDatabase();
    const recordKey = `${collection}:${key}`;
    if (!db) {
      const ledger = await fallbackLedger();
      await AsyncStorage.removeItem(fallbackKey(recordKey));
      delete ledger.entries[recordKey];
      await saveFallbackLedger(ledger);
      const usedBytes = Object.values(ledger.entries).reduce((total, entry) => total + Number(entry.bytes || 0), 0);
      usageListeners.forEach(listener => listener({ usedBytes: Math.min(usedBytes, LIMIT_BYTES), limitBytes: LIMIT_BYTES }));
      return true;
    }

    const result = await db.runAsync('DELETE FROM records WHERE key = ?', recordKey);
    if (result.changes > 0) {
      const usage = await this.getUsage();
      usageListeners.forEach(listener => listener(usage));
    }
    return result.changes > 0;
  },

  async getCollection(collection) {
    const db = await getDatabase();
    if (!db) {
      const ledger = await fallbackLedger();
      const records = await Promise.all(Object.values(ledger.entries)
        .filter(entry => entry.collection === collection)
        .sort((first, second) => second.accessedAt - first.accessedAt)
        .map(async entry => ({ key: entry.key.slice(collection.length + 1), value: await fallbackRead(entry.key) })));
      return records.filter(record => record.value != null);
    }
    const rows = await db.getAllAsync('SELECT key, value FROM records WHERE collection = ? ORDER BY accessed_at DESC', collection);
    return rows.map(row => ({ key: row.key.slice(collection.length + 1), value: JSON.parse(row.value) }));
  },

  async enqueue(action) {
    const item = {
      id: action.id || `queue_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      actionType: action.actionType, entityType: action.entityType, entityId: action.entityId,
      payload: action.payload, createdAt: action.createdAt || timestamp(), retryCount: action.retryCount || 0,
      nextAttemptAt: action.nextAttemptAt || 0, status: action.status || 'pending', lastError: action.lastError || null,
    };
    const db = await getDatabase();
    if (!db) {
      const current = (await fallbackRead('sync_queue')) || [];
      await AsyncStorage.setItem(fallbackKey('sync_queue'), JSON.stringify(current.filter(x => x.id !== item.id).concat(item)));
      return item;
    }
    await db.runAsync(
      `INSERT OR REPLACE INTO sync_queue(id, action_type, entity_type, entity_id, payload, created_at,
       retry_count, next_attempt_at, status, last_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      item.id, item.actionType, item.entityType, item.entityId, JSON.stringify(item.payload), item.createdAt,
      item.retryCount, item.nextAttemptAt, item.status, item.lastError
    );
    return item;
  },

  async getDueActions() {
    const db = await getDatabase();
    if (!db) return (await fallbackRead('sync_queue')) || [];
    const rows = await db.getAllAsync("SELECT * FROM sync_queue WHERE status = 'pending' AND next_attempt_at <= ? ORDER BY created_at ASC", timestamp());
    return rows.map(row => ({
      id: row.id, actionType: row.action_type, entityType: row.entity_type, entityId: row.entity_id,
      payload: JSON.parse(row.payload), createdAt: row.created_at, retryCount: row.retry_count,
      nextAttemptAt: row.next_attempt_at, status: row.status, lastError: row.last_error,
    }));
  },

  async completeAction(id) {
    const db = await getDatabase();
    if (!db) {
      const current = (await fallbackRead('sync_queue')) || [];
      await AsyncStorage.setItem(fallbackKey('sync_queue'), JSON.stringify(current.filter(x => x.id !== id)));
      return;
    }
    await db.runAsync('DELETE FROM sync_queue WHERE id = ?', id);
  },

  async deferAction(action, error) {
    const delays = [2000, 5000, 15000, 30000, 60000];
    const retryCount = (action.retryCount || 0) + 1;
    const updated = { ...action, retryCount, nextAttemptAt: timestamp() + delays[Math.min(retryCount - 1, delays.length - 1)], lastError: error?.message || String(error) };
    const db = await getDatabase();
    if (!db) {
      const current = (await fallbackRead('sync_queue')) || [];
      await AsyncStorage.setItem(fallbackKey('sync_queue'), JSON.stringify(current.map(x => x.id === action.id ? updated : x)));
      return updated;
    }
    await db.runAsync('UPDATE sync_queue SET retry_count = ?, next_attempt_at = ?, last_error = ? WHERE id = ?', retryCount, updated.nextAttemptAt, updated.lastError, action.id);
    return updated;
  },

  async getUsage() {
    const db = await getDatabase();
    if (!db) {
      const ledger = await fallbackLedger();
      const usedBytes = Object.values(ledger.entries).reduce((total, entry) => total + Number(entry.bytes || 0), 0);
      return { usedBytes: Math.min(usedBytes, LIMIT_BYTES), limitBytes: LIMIT_BYTES };
    }
    const result = await db.getFirstAsync('SELECT COALESCE(SUM(bytes), 0) AS usedBytes FROM records');
    return { usedBytes: Number(result?.usedBytes || 0), limitBytes: LIMIT_BYTES };
  },

  async getMetadata(key) {
    const db = await getDatabase();
    if (!db) return AsyncStorage.getItem(`${FALLBACK_PREFIX}meta:${key}`);
    const row = await db.getFirstAsync('SELECT value FROM metadata WHERE key = ?', key);
    return row?.value || null;
  },

  async setMetadata(key, value) {
    const db = await getDatabase();
    if (!db) return AsyncStorage.setItem(`${FALLBACK_PREFIX}meta:${key}`, String(value));
    await db.runAsync('INSERT OR REPLACE INTO metadata(key, value) VALUES (?, ?)', key, String(value));
  },

  async evict(maxBytes = LIMIT_BYTES) {
    const db = await getDatabase();
    if (!db) return;
    const usage = await this.getUsage();
    let usedBytes = usage.usedBytes;
    const rows = await db.getAllAsync('SELECT key, bytes FROM records WHERE protected = 0 ORDER BY priority ASC, accessed_at ASC');
    for (const row of rows) {
      if (usedBytes <= maxBytes) break;
      await db.runAsync('DELETE FROM records WHERE key = ?', row.key);
      usedBytes -= row.bytes;
    }
  },
};

export const OFFLINE_CACHE_LIMIT_BYTES = LIMIT_BYTES;
