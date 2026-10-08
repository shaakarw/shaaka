const crypto = require('crypto');
const {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');

const URL_TTL_SECONDS = 7 * 24 * 60 * 60;
const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/mpeg': 'mpeg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
};

class StorageError extends Error {
  constructor(message, code = 'STORAGE_ERROR', statusCode = 502) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

let client;

function getConfiguration() {
  const required = ['B2_KEY_ID', 'B2_APPLICATION_KEY', 'B2_BUCKET_NAME', 'B2_ENDPOINT', 'B2_REGION'];
  const missing = required.filter(name => {
    const value = process.env[name];
    return !value || /^YOUR_/i.test(value);
  });

  if (missing.length) {
    throw new StorageError(`Backblaze B2 is not configured. Missing or placeholder values: ${missing.join(', ')}`, 'B2_NOT_CONFIGURED', 503);
  }

  let endpoint;
  try {
    endpoint = new URL(process.env.B2_ENDPOINT);
  } catch {
    throw new StorageError('Backblaze B2 endpoint is invalid.', 'B2_INVALID_CONFIGURATION', 503);
  }
  if (!['https:', 'http:'].includes(endpoint.protocol) || !endpoint.hostname) {
    throw new StorageError('Backblaze B2 endpoint is invalid.', 'B2_INVALID_CONFIGURATION', 503);
  }

  return {
    keyId: process.env.B2_KEY_ID,
    applicationKey: process.env.B2_APPLICATION_KEY,
    bucketName: process.env.B2_BUCKET_NAME,
    endpoint: endpoint.toString().replace(/\/$/, ''),
    region: process.env.B2_REGION,
  };
}

function getClient() {
  if (client) return client;
  const config = getConfiguration();
  client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.keyId,
      secretAccessKey: config.applicationKey,
    },
  });
  return client;
}

function normalizeMimeType(mimeType = '') {
  const type = String(mimeType).toLowerCase().split(';')[0].trim();
  return type === 'image/jpg' ? 'image/jpeg' : type;
}

function fileTypeForMime(mimeType = '') {
  const type = normalizeMimeType(mimeType);
  if (MIME_EXTENSIONS[type]) return type.split('/')[0];
  throw new StorageError('Unsupported file type.', 'INVALID_FILE_TYPE', 400);
}

function createObjectKey(folder, mimeType) {
  const segments = String(folder || 'uploads')
    .split('/')
    .filter(Boolean)
    .map(segment => segment.replace(/[^a-zA-Z0-9_-]/g, '_'));
  const type = normalizeMimeType(mimeType);
  const extension = MIME_EXTENSIONS[type];
  if (!extension) throw new StorageError('Unsupported file type.', 'INVALID_FILE_TYPE', 400);
  return ['shaaka', ...segments, `${crypto.randomUUID()}.${extension}`].join('/');
}

async function upload({ buffer, mimeType, folder, maxBytes }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw new StorageError('The uploaded file is empty or invalid.', 'INVALID_FILE', 400);
  }
  const normalizedMimeType = normalizeMimeType(mimeType);
  const fileType = fileTypeForMime(normalizedMimeType);
  if (maxBytes && buffer.length > maxBytes) {
    throw new StorageError('The uploaded file exceeds the size limit.', 'FILE_TOO_LARGE', 413);
  }
  const config = getConfiguration();
  const key = createObjectKey(folder, mimeType);

  try {
    await getClient().send(new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: buffer,
      ContentType: normalizedMimeType,
      ContentLength: buffer.length,
    }));
    const uploadedObject = await getClient().send(new HeadObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    }));
    const expectedExtension = MIME_EXTENSIONS[normalizedMimeType];
    if (uploadedObject.ContentLength !== buffer.length ||
      normalizeMimeType(uploadedObject.ContentType) !== normalizedMimeType ||
      !key.endsWith(`.${expectedExtension}`)) {
      throw new StorageError('Backblaze B2 upload verification failed.', 'B2_UPLOAD_VERIFICATION_FAILED', 502);
    }
  } catch (error) {
    throw mapB2Error(error, 'upload');
  }

  return {
    storageProvider: 'b2',
    storageKey: key,
    fileName: key.split('/').pop(),
    fileType,
    mimeType: normalizedMimeType,
    fileSize: buffer.length,
  };
}

function createMediaUrl(key, { origin, isPrivate = false } = {}) {
  if (!isPrivate) return createPublicMediaUrl(key);
  const baseUrl = String(origin || process.env.API_PUBLIC_URL || '').replace(/\/$/, '');
  if (!baseUrl) throw new StorageError('Public API URL is not configured.', 'B2_INVALID_CONFIGURATION', 503);
  const encodedKey = String(key).split('/').map(encodeURIComponent).join('/');
  const url = new URL(`${baseUrl}/api/media/${encodedKey}`);
  if (isPrivate) {
    const expires = Math.floor(Date.now() / 1000) + URL_TTL_SECONDS;
    url.searchParams.set('expires', String(expires));
    url.searchParams.set('signature', signUrl(key, expires));
  }
  return url.toString();
}

function getPublicDownloadHost(config = getConfiguration()) {
  const regionNumber = new URL(config.endpoint).hostname.match(/-(\d{3})\.backblazeb2\.com$/i)?.[1];
  if (!regionNumber) {
    throw new StorageError('Backblaze B2 download region could not be derived from the configured endpoint.', 'B2_INVALID_CONFIGURATION', 503);
  }
  return `f${regionNumber}.backblazeb2.com`;
}

function createPublicMediaUrl(key) {
  if (!isStorageKey(key)) throw new StorageError('The media storage key is invalid.', 'INVALID_STORAGE_KEY', 400);
  const config = getConfiguration();
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  const bucket = encodeURIComponent(config.bucketName);
  return `https://${getPublicDownloadHost(config)}/file/${bucket}/${encodedKey}`;
}

function isPublicMediaUrl(url, key) {
  try {
    const parsed = new URL(url);
    const expected = new URL(createPublicMediaUrl(key));
    return parsed.protocol === 'https:' &&
      parsed.hostname === expected.hostname &&
      decodeURIComponent(parsed.pathname) === decodeURIComponent(expected.pathname) &&
      !parsed.search &&
      !parsed.hash;
  } catch {
    return false;
  }
}

async function verifyPublicAccess(url, mimeType) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
    const contentType = normalizeMimeType(response.headers.get('content-type'));
    if (!response.ok || contentType !== normalizeMimeType(mimeType)) {
      throw new StorageError('The uploaded B2 image is not publicly accessible with the expected content type.', 'B2_PUBLIC_ACCESS_FAILED', 502);
    }
    return true;
  } catch (error) {
    if (error instanceof StorageError) throw error;
    throw new StorageError('The uploaded B2 image could not be verified as publicly accessible.', 'B2_PUBLIC_ACCESS_FAILED', 502);
  } finally {
    clearTimeout(timeout);
  }
}

function signUrl(key, expires) {
  const secret = process.env.B2_APPLICATION_KEY;
  if (!secret || /^YOUR_/i.test(secret)) {
    throw new StorageError('Backblaze B2 is not configured for private media.', 'B2_NOT_CONFIGURED', 503);
  }
  return crypto.createHmac('sha256', secret).update(`${key}:${expires}`).digest('hex');
}

function verifyPrivateUrl(key, expires, signature) {
  const expiration = Number(expires);
  if (!Number.isSafeInteger(expiration) || expiration < Math.floor(Date.now() / 1000) || !signature) return false;
  const expected = Buffer.from(signUrl(key, expiration), 'hex');
  let actual;
  try {
    actual = Buffer.from(String(signature), 'hex');
  } catch {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function mapB2Error(error, operation) {
  const statusCode = error?.$metadata?.httpStatusCode;
  const code = error?.name || error?.Code || error?.code;
  if (code === 'NoSuchKey' || code === 'NotFound' || statusCode === 404) {
    return new StorageError('The requested media file was not found.', 'OBJECT_NOT_FOUND', 404);
  }
  if (code === 'InvalidAccessKeyId' || code === 'SignatureDoesNotMatch' || statusCode === 401 || statusCode === 403) {
    return new StorageError('Backblaze B2 rejected the configured credentials or bucket permissions.', 'B2_AUTHENTICATION_FAILED', 503);
  }
  if (code === 'NoSuchBucket') {
    return new StorageError('The configured Backblaze B2 bucket does not exist or is unavailable.', 'B2_BUCKET_NOT_FOUND', 503);
  }
  if (error instanceof StorageError) return error;
  return new StorageError(`Backblaze B2 ${operation} failed.`, 'B2_OPERATION_FAILED', 502);
}

async function getObject(key, range) {
  const config = getConfiguration();
  try {
    return await getClient().send(new GetObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      ...(range ? { Range: range } : {}),
    }));
  } catch (error) {
    throw mapB2Error(error, 'download');
  }
}

async function deleteObject(key) {
  if (!key || !isStorageKey(key)) return;
  const config = getConfiguration();
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: config.bucketName, Key: key }));
  } catch (error) {
    const mapped = mapB2Error(error, 'delete');
    if (mapped.code !== 'OBJECT_NOT_FOUND') throw mapped;
  }
}

function isStorageKey(key) {
  return typeof key === 'string' && key.startsWith('shaaka/') && !key.includes('..') && !key.includes('\\');
}

function storageKeyFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    const marker = '/api/media/';
    const index = parsed.pathname.indexOf(marker);
    if (index >= 0) {
      const key = decodeURIComponent(parsed.pathname.slice(index + marker.length));
      return isStorageKey(key) ? key : null;
    }

    const config = getConfiguration();
    const bucketPrefix = `/file/${encodeURIComponent(config.bucketName)}/`;
    if (parsed.protocol !== 'https:' || parsed.hostname !== getPublicDownloadHost(config) || !parsed.pathname.startsWith(bucketPrefix)) {
      return null;
    }
    const key = decodeURIComponent(parsed.pathname.slice(bucketPrefix.length));
    return isStorageKey(key) ? key : null;
  } catch {
    return null;
  }
}

module.exports = {
  StorageError,
  createMediaUrl,
  createPublicMediaUrl,
  deleteObject,
  fileTypeForMime,
  getObject,
  isStorageKey,
  isPublicMediaUrl,
  mapB2Error,
  storageKeyFromUrl,
  upload,
  verifyPublicAccess,
  verifyPrivateUrl,
};