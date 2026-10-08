const b2Storage = require('./b2Storage');

async function uploadMedia(options) {
  return b2Storage.upload(options);
}

function getMediaUrl(storageKey, options) {
  return b2Storage.createMediaUrl(storageKey, options);
}

function getPublicMediaUrl(storageKey) {
  return b2Storage.createPublicMediaUrl(storageKey);
}

function isPublicMediaUrl(url, storageKey) {
  return b2Storage.isPublicMediaUrl(url, storageKey);
}

function verifyPublicMediaAccess(url, mimeType) {
  return b2Storage.verifyPublicAccess(url, mimeType);
}

function getRequestOrigin(req) {
  return String(process.env.API_PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

async function deleteMedia(storageKey) {
  return b2Storage.deleteObject(storageKey);
}

async function getMediaObject(storageKey, range) {
  return b2Storage.getObject(storageKey, range);
}

function getStorageKeyFromUrl(url) {
  return b2Storage.storageKeyFromUrl(url);
}

function collectStorageKeys(urls) {
  return (Array.isArray(urls) ? urls : []).map(getStorageKeyFromUrl).filter(Boolean);
}

function isStorageKey(storageKey) {
  return b2Storage.isStorageKey(storageKey);
}

function verifyPrivateMediaUrl(storageKey, expires, signature) {
  return b2Storage.verifyPrivateUrl(storageKey, expires, signature);
}

module.exports = {
  deleteMedia,
  getMediaObject,
  getMediaUrl,
  getPublicMediaUrl,
  getRequestOrigin,
  getStorageKeyFromUrl,
  collectStorageKeys,
  isStorageKey,
  isPublicMediaUrl,
  uploadMedia,
  verifyPublicMediaAccess,
  verifyPrivateMediaUrl,
};