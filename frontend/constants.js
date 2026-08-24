import { Platform } from 'react-native';

let ExpoConstants = {};
try {
  ExpoConstants = require('expo-constants');
} catch (error) {
  ExpoConstants = {};
}

const ENV_BASE_URL = process.env.EXPO_PUBLIC_API_URL || process.env.API_URL;
const LOCAL_LAN_BASE_URL_LIST = [
  'http://192.168.1.69:5000',
  'http://192.168.1.64:5000',
  'http://192.168.1.65:5000',
  'http://192.168.1.67:5000',
  'http://192.168.0.10:5000',
  'http://192.168.0.20:5000',
  'http://192.168.8.100:5000',
  'http://10.0.2.2:5000',
  'http://localhost:5000',
];
const FALLBACK_BASE_URL_VALUE = 'http://localhost:5000';

const getDetectedHost = () => {
  try {
    const hostUri = ExpoConstants?.expoConfig?.hostUri || ExpoConstants?.manifest?.debuggerHost || ExpoConstants?.manifest2?.extra?.expoGo?.hostUri;
    if (!hostUri) return null;

    const host = hostUri.split(':')[0];
    if (!host || host === 'localhost' || host === '127.0.0.1') return null;
    return host;
  } catch (error) {
    return null;
  }
};

const getBaseUrl = () => {
  if (ENV_BASE_URL) return ENV_BASE_URL;

  const detectedHost = getDetectedHost();
  if (detectedHost) {
    return `http://${detectedHost}:5000`;
  }

  if (Platform.OS === 'web') {
    const location = typeof window !== 'undefined' ? window.location : undefined;
    if (location && location.hostname === 'localhost') {
      return FALLBACK_BASE_URL_VALUE;
    }
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000';
  }

  return LOCAL_LAN_BASE_URL_LIST[0];
};

export const BASE_URL = getBaseUrl();
export const LOCAL_LAN_BASE_URLS = LOCAL_LAN_BASE_URL_LIST;
export const FALLBACK_BASE_URL = FALLBACK_BASE_URL_VALUE;