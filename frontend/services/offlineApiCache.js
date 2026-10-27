import axios from 'axios';
import { offlineDatabase } from './offlineDatabase';
import { isStartupPerformanceActive } from './startupPerformance';
import { logPerformance } from '../utils/performanceLogger';
import { networkStatus } from './networkStatus';

const CACHE_COLLECTION = 'http-cache';

const logRequestDuration = (config, status) => {
  if (!config?.metadata?.logDuringStartup) return;
  const startedAt = config?.metadata?.performanceStartedAt;
  if (!startedAt) return;
  const path = String(config.url || '').replace(/^https?:\/\/[^/]+/i, '').split('?')[0];
  if (/\/api\/(posts|messages)(\/|$)/i.test(path)) return;
  const statusText = status == null ? 'network-error' : `status=${status}`;
  logPerformance(`[Perf][API] ${config.method?.toUpperCase() || 'GET'} ${path} ${Date.now() - startedAt}ms ${statusText}`);
};

const stableStringify = value => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const fingerprint = value => {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`;
};

const getHeader = (headers, name) => (
  typeof headers?.get === 'function'
    ? headers.get(name)
    : headers?.[name] || headers?.[name.toLowerCase()]
);

const cacheKeyFor = config => {
  const url = `${config.baseURL || ''}${config.url || ''}`;
   if (!url.includes('/api/')) return null;
  if (/\/api\/(auth\/session|user\/[^/]+\/online)(\?|$)/i.test(url)) return null;

  const authorization = getHeader(config.headers, 'Authorization') || '';
  const params = config.params ? stableStringify(config.params) : '';
  return fingerprint(`${authorization}|${url}|${params}`);
};

const persistResponse = async response => {
  const config = response?.config;
  if (config?.method?.toLowerCase() !== 'get') return;
  const key = cacheKeyFor(config);
  if (!key || response.status < 200 || response.status >= 300) return;

  const record = { data: response.data, status: response.status, statusText: response.statusText };
  try {
    await offlineDatabase.putRecord(CACHE_COLLECTION, key, record, { priority: 'medium' });
  } catch (error) {
    // Cache failures should never turn a successful request into a failed one.
  }
};

export const installOfflineApiCache = () => {
  const onRequest = axios.interceptors.request.use(async config => {
    config.metadata = {
      ...config.metadata,
      performanceStartedAt: Date.now(),
      logDuringStartup: isStartupPerformanceActive(),
    };
    const url = `${config.baseURL || ''}${config.url || ''}`;
    if (/\/api(?:\/|$)/i.test(url) && !(await networkStatus.start()).isOnline) {
      const error = new Error('Network Error');
      error.code = 'ERR_NETWORK';
      error.config = config;
      throw error;
    }
    return config;
  });
  const onSuccess = axios.interceptors.response.use(response => {
    logRequestDuration(response.config, response.status);
    persistResponse(response).catch(() => {});
    return response;
  });
  const onError = axios.interceptors.response.use(undefined, async error => {
    const config = error?.config;
    logRequestDuration(config, error?.response?.status);
    if (config?.method?.toLowerCase() === 'get' && !error.response && !config.metadata?.disableOfflineFallback) {
      const key = cacheKeyFor(config);
      if (key) {
        try {
          const cached = await offlineDatabase.getRecord(CACHE_COLLECTION, key);
          if (cached) {
            return {
              data: cached.data,
              status: cached.status,
              statusText: 'OK (offline cache)',
              headers: {},
              config,
              request: error.request,
              fromOfflineCache: true,
            };
          }
        } catch (cacheError) {
          // Preserve the original request error when the cache is unavailable.
        }
      }
    }
    return Promise.reject(error);
  });

  return () => {
    axios.interceptors.request.eject(onRequest);
    axios.interceptors.response.eject(onSuccess);
    axios.interceptors.response.eject(onError);
  };
};