const { getClient } = require('../config/db');

const PERMISSION_TIME_ZONE = 'Africa/Kigali';
const DAILY_PERMISSION_KEYS = new Set([
  'posts',
  'videos',
  'place_products',
  'mall_products',
]);
const LIFETIME_PERMISSION_KEYS = new Set(['shops_places', 'mall_shops']);

const getKigaliDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: PERMISSION_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(date);

const getNextDailyReset = (date = new Date()) => {
  const reset = new Date(date);
  reset.setUTCHours(22, 0, 0, 0);
  if (reset <= date) reset.setUTCDate(reset.getUTCDate() + 1);
  return reset;
};

const validateUsage = (userId, key, amount, limit, keys, label) => {
  if (!userId || !keys.has(key)) throw new TypeError(`Invalid ${label} permission usage key.`);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new TypeError('Usage amount must be a positive integer.');
  if (!Number.isSafeInteger(limit) || limit < 0) throw new TypeError('Permission limit must be a non-negative integer.');
};

const reserveDailyUsage = async (userId, key, amount, limit, now = new Date()) => {
  validateUsage(userId, key, amount, limit, DAILY_PERMISSION_KEYS, 'daily');
  if (amount > limit) return false;

  const result = await getClient().execute({
    sql: `
      INSERT INTO daily_permission_usage (user_id, permission_key, usage_day, used, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (user_id, permission_key, usage_day) DO UPDATE
      SET used = daily_permission_usage.used + excluded.used, updated_at = excluded.updated_at
      WHERE daily_permission_usage.used + excluded.used <= ?
      RETURNING used
    `,
    args: [String(userId), key, getKigaliDate(now), amount, now.toISOString(), limit],
  });
  return result.rows.length > 0;
};

const releaseDailyUsage = async (userId, key, amount, now = new Date()) => {
  validateUsage(userId, key, amount, Number.MAX_SAFE_INTEGER, DAILY_PERMISSION_KEYS, 'daily');
  const database = getClient();
  const usageDay = getKigaliDate(now);
  await database.execute({
    sql: `
      UPDATE daily_permission_usage
      SET used = MAX(0, used - ?), updated_at = ?
      WHERE user_id = ? AND permission_key = ? AND usage_day = ?
    `,
    args: [amount, now.toISOString(), String(userId), key, usageDay],
  });
  await database.execute({
    sql: 'DELETE FROM daily_permission_usage WHERE user_id = ? AND permission_key = ? AND usage_day = ? AND used = 0',
    args: [String(userId), key, usageDay],
  });
};

const getDailyUsage = async (userId, key, now = new Date()) => {
  if (!userId || !DAILY_PERMISSION_KEYS.has(key)) throw new TypeError('Invalid daily permission usage key.');
  const result = await getClient().execute({
    sql: 'SELECT used FROM daily_permission_usage WHERE user_id = ? AND permission_key = ? AND usage_day = ?',
    args: [String(userId), key, getKigaliDate(now)],
  });
  return Number(result.rows[0]?.used || 0);
};

const reserveLifetimeUsage = async (userId, key, amount, limit) => {
  validateUsage(userId, key, amount, limit, LIFETIME_PERMISSION_KEYS, 'lifetime');
  if (amount > limit) return false;

  const result = await getClient().execute({
    sql: `
      INSERT INTO lifetime_permission_usage (user_id, permission_key, used, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (user_id, permission_key) DO UPDATE
      SET used = lifetime_permission_usage.used + excluded.used, updated_at = excluded.updated_at
      WHERE lifetime_permission_usage.used + excluded.used <= ?
      RETURNING used
    `,
    args: [String(userId), key, amount, new Date().toISOString(), limit],
  });
  return result.rows.length > 0;
};

const releaseLifetimeUsage = async (userId, key, amount) => {
  validateUsage(userId, key, amount, Number.MAX_SAFE_INTEGER, LIFETIME_PERMISSION_KEYS, 'lifetime');
  await getClient().execute({
    sql: `
      UPDATE lifetime_permission_usage
      SET used = MAX(0, used - ?), updated_at = ?
      WHERE user_id = ? AND permission_key = ?
    `,
    args: [amount, new Date().toISOString(), String(userId), key],
  });
};

const getLifetimeUsage = async (userId, key) => {
  if (!userId || !LIFETIME_PERMISSION_KEYS.has(key)) throw new TypeError('Invalid lifetime permission usage key.');
  const result = await getClient().execute({
    sql: 'SELECT used FROM lifetime_permission_usage WHERE user_id = ? AND permission_key = ?',
    args: [String(userId), key],
  });
  return Number(result.rows[0]?.used || 0);
};

module.exports = {
  PERMISSION_TIME_ZONE,
  getKigaliDate,
  getNextDailyReset,
  getDailyUsage,
  getLifetimeUsage,
  reserveDailyUsage,
  releaseDailyUsage,
  reserveLifetimeUsage,
  releaseLifetimeUsage,
};
