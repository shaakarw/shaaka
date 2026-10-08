import { getApiUrl, getApiUrls } from './config';

export const BASE_URL = getApiUrl();
export const LOCAL_LAN_BASE_URLS = getApiUrls().filter((url) => url !== BASE_URL);
export const FALLBACK_BASE_URL = 'http://localhost:5000';