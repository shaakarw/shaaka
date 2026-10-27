const debugLoggingEnabled = process.env.EXPO_PUBLIC_DEBUG_LOGS === 'true';

export const logDebug = (...args) => {
  if (debugLoggingEnabled) console.log(...args);
};

export const warnDebug = (...args) => {
  if (debugLoggingEnabled) console.warn(...args);
};
