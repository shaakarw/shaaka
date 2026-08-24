// utils/onlineStore.js
const onlineMap = new Map();

exports.setOnline = (userId, isOnline) => {
  if (!userId) return;
  const now = new Date();
  onlineMap.set(String(userId), {
    isOnline,
    lastSeen: isOnline ? null : now,
    ts: Date.now(),
  });
};

exports.isOnline = (userId) => {
  if (!userId) return { isOnline: false, lastSeen: null };
  const entry = onlineMap.get(String(userId));
  if (!entry) return { isOnline: false, lastSeen: null };
  const TTL = 5 * 60 * 1000; // 5 minutes
  if (entry.isOnline && Date.now() - entry.ts < TTL) {
    return { isOnline: true, lastSeen: null };
  }
  return { isOnline: false, lastSeen: entry.lastSeen || null };
};

exports.getAll = () => {
  const obj = {};
  for (const [k, v] of onlineMap.entries()) obj[k] = v;
  return obj;
};