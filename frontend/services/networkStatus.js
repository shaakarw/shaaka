import NetInfo from '@react-native-community/netinfo';

let currentStatus = {
  isConnected: true,
  isInternetReachable: true,
  isOnline: true,
  type: 'unknown',
  isConnectionExpensive: false,
  cellularGeneration: null,
};
const listeners = new Set();
let started = false;
let unsubscribe = null;
let startPromise = null;

const normalize = state => {
  const isConnected = state.isConnected !== false;
  const isInternetReachable = state.isInternetReachable !== false;
  return {
    isConnected,
    isInternetReachable,
    isOnline: isConnected && isInternetReachable,
    type: state.type || 'unknown',
    isConnectionExpensive: Boolean(state.details?.isConnectionExpensive),
    cellularGeneration: state.details?.cellularGeneration || null,
  };
};

export const networkStatus = {
  async start() {
    if (started) return startPromise || currentStatus;
    started = true;
    startPromise = (async () => {
      currentStatus = normalize(await NetInfo.fetch());
      unsubscribe = NetInfo.addEventListener(state => {
        currentStatus = normalize(state);
        listeners.forEach(listener => listener(currentStatus));
      });
      return currentStatus;
    })();
    try {
      return await startPromise;
    } finally {
      startPromise = null;
    }
  },

  get() {
    return currentStatus;
  },

  subscribe(listener) {
    listeners.add(listener);
    this.start();
    listener(currentStatus);
    return () => listeners.delete(listener);
  },

  stop() {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    started = false;
    startPromise = null;
    listeners.clear();
  },
};
