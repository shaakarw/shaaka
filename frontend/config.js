// config.js
import { Platform } from 'react-native';

let ExpoConstants = {};
try {
  ExpoConstants = require('expo-constants');
} catch (error) {
  ExpoConstants = {};
}

const DEFAULT_API_URL = 'https://happy-encouragement-production-5de2a884.up.railway.app';
const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL || process.env.API_URL || DEFAULT_API_URL;
const LOCAL_LAN_API_URLS = [
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
const EMULATOR_API_URL = 'http://10.0.2.2:5000';
const LOCALHOST_API_URL = 'http://localhost:5000';

const isAndroidEmulator = () => {
  if (Platform.OS !== 'android') return false;
  const deviceDescription = [
    Platform.constants?.Model,
    Platform.constants?.Fingerprint,
    ExpoConstants?.deviceName,
  ].filter(Boolean).join(' ');
  return /(emulator|sdk_gphone|google_sdk|generic_x86|generic_arm)/i.test(deviceDescription);
};

const getConfiguredApiUrl = () => {
  if (!ENV_API_URL) return null;
  if (!isAndroidEmulator()) return ENV_API_URL;
  try {
    const url = new URL(ENV_API_URL);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      url.hostname = '10.0.2.2';
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return ENV_API_URL;
  }
};

const getDetectedHostUrl = () => {
  try {
    const hostUri = ExpoConstants?.expoConfig?.hostUri || ExpoConstants?.manifest?.debuggerHost || ExpoConstants?.manifest2?.extra?.expoGo?.hostUri;
    if (!hostUri) return null;

    const host = hostUri.split(':')[0];
    if (!host || host === 'localhost' || host === '127.0.0.1') return null;
    return `http://${host}:5000`;
  } catch (error) {
    return null;
  }
};

export const getApiUrl = () => {
  if (Platform.OS === 'web') {
    return ENV_API_URL.replace(/\/$/, '');
  }

  const configuredApiUrl = getConfiguredApiUrl();
  if (configuredApiUrl) return configuredApiUrl;

  if (isAndroidEmulator()) return EMULATOR_API_URL;

  const detectedHostUrl = getDetectedHostUrl();
  if (detectedHostUrl) return detectedHostUrl;

  if (Platform.OS === 'android') {
    return EMULATOR_API_URL || LOCALHOST_API_URL;
  }

  if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    return LOCALHOST_API_URL;
  }

  return LOCAL_LAN_API_URLS[0] || EMULATOR_API_URL || LOCALHOST_API_URL;
};

export const getApiUrls = () => {
  if (Platform.OS === 'web') return [getApiUrl()];

  return [
    getConfiguredApiUrl(),
    isAndroidEmulator() ? EMULATOR_API_URL : getDetectedHostUrl(),
    ...LOCAL_LAN_API_URLS,
    EMULATOR_API_URL,
    LOCALHOST_API_URL,
  ].filter(Boolean);
};