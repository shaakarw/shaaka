import { Platform } from 'react-native';
import { BASE_URL } from '../constants';

const isLoopback = host => (
  host === 'localhost'
  || host === '127.0.0.1'
  || host === '::1'
  || host === '[::1]'
);

const isPrivateIpv4 = host => {
  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) {
    return false;
  }
  return octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
};

const getBaseUrl = () => {
  try {
    const base = new URL(BASE_URL);
    if (Platform.OS === 'android' && isLoopback(base.hostname)) {
      base.hostname = '10.0.2.2';
    }
    return base.toString().replace(/\/$/, '');
  } catch {
    return String(BASE_URL).replace(/\/$/, '');
  }
};

const isLocalUri = uri => /^(?:data|file|content|asset|blob):/i.test(uri);

export const getImageUri = value => {
  if (typeof value === 'string') return value.trim() || null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return getImageUri(value.uri || value.url || value.originalUrl || value.src || value.secure_url);
};

export const normalizeImageUrl = value => {
  if (typeof value !== 'string') return null;
  const uri = value.trim();
  if (!uri) return null;
  if (isLocalUri(uri)) return uri;

  const baseUrl = getBaseUrl();
  if (/^shaaka\//i.test(uri)) {
    const encodedKey = uri.split('/').map(encodeURIComponent).join('/');
    return `${baseUrl}/api/media/${encodedKey}`;
  }

  try {
    const base = new URL(`${baseUrl}/`);
    const resolved = new URL(uri, base);
    const isExpectedApiPort = !resolved.port
      || resolved.port === '5000'
      || resolved.port === base.port;
    const isLegacyLocalBackend = Platform.OS === 'android'
      && isExpectedApiPort
      && (isLoopback(resolved.hostname)
        || isPrivateIpv4(resolved.hostname));
    if (isLegacyLocalBackend) {
      resolved.protocol = base.protocol;
      resolved.host = base.host;
    }
    return resolved.toString();
  } catch {
    return uri;
  }
};

export const normalizeImageSource = source => {
  if (typeof source === 'string') {
    const uri = normalizeImageUrl(source);
    return uri ? { uri } : null;
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return source;

  const uri = getImageUri(source);
  if (typeof uri !== 'string') return source;
  const uriToNormalize = /^(?:file|content|asset):/i.test(uri)
    && typeof source.storageKey === 'string'
    ? source.storageKey
    : uri;
  const imageSource = { ...source };
  delete imageSource.storageKey;
  return {
    ...imageSource,
    uri: normalizeImageUrl(uriToNormalize),
  };
};
