// utils/typingStore.js
const typingMap = new Map();

const makeKey = (postId, userA, userB) => {
  const ids = [String(userA), String(userB)].sort();
  const key = `${postId}_${ids[0]}_${ids[1]}`;
  console.log('[TYPING-STORE] makeKey:', { postId, userA, userB, key });
  return key;
};

exports.setTyping = (postId, fromUser, toUser, isTyping) => {
  const key = makeKey(postId, fromUser, toUser);
  console.log('[TYPING-STORE] setTyping:', {
    postId,
    fromUser,
    toUser,
    isTyping,
    key,
  });

  if (isTyping) {
    const entry = { by: fromUser, ts: Date.now() };
    typingMap.set(key, entry);
    console.log('[TYPING-STORE] setTyping: entry STORED', {
      key,
      entry,
      mapSize: typingMap.size,
      allKeys: Array.from(typingMap.keys()),
    });
  } else {
    const deleted = typingMap.delete(key);
    console.log('[TYPING-STORE] setTyping: entry DELETED', {
      key,
      deleted,
      mapSize: typingMap.size,
      allKeys: Array.from(typingMap.keys()),
    });
  }
};

exports.isTyping = (postId, userA, userB) => {
  const key = makeKey(postId, userA, userB);
  const entry = typingMap.get(key);
  const TTL = 5000; // 5 seconds
  const now = Date.now();
  const isExpired = entry ? (now - entry.ts) : 'N/A';

  console.log('[TYPING-STORE] isTyping:', {
    postId,
    userA,
    userB,
    key,
    entry,
    now,
    isExpired,
    TTL,
    mapSize: typingMap.size,
    allKeys: Array.from(typingMap.keys()),
  });

  if (entry && now - entry.ts < TTL) {
    const result = { typing: true, by: entry.by };
    console.log('[TYPING-STORE] isTyping: user IS typing', result);
    return result;
  }

  const result = { typing: false, by: null };
  console.log('[TYPING-STORE] isTyping: user is NOT typing', result);
  return result;
};