const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveStoredImageUrl } = require('./storedImageUrl');

test('resolves a device-local image URI from its storage key', () => {
  const storageService = {
    isStorageKey: key => key.startsWith('shaaka/'),
    getMediaUrl: key => `https://media.example/${key}`,
  };
  const result = resolveStoredImageUrl(
    'file:///data/user/0/app/image.jpg',
    'shaaka/places/image.jpg',
    storageService
  );

  assert.equal(result, 'https://media.example/shaaka/places/image.jpg');
});

test('preserves remote URLs and local URIs without a storage key', () => {
  const storageService = {
    isStorageKey: key => key.startsWith('shaaka/'),
    getMediaUrl: () => {
      throw new Error('Should not resolve this image');
    },
  };

  assert.equal(
    resolveStoredImageUrl('https://media.example/image.jpg', 'shaaka/image.jpg', storageService),
    'https://media.example/image.jpg'
  );
  assert.equal(
    resolveStoredImageUrl('file:///data/user/0/app/image.jpg', '', storageService),
    'file:///data/user/0/app/image.jpg'
  );
  assert.equal(
    resolveStoredImageUrl(
      'file:///data/user/0/app/image.jpg',
      'invalid-key',
      storageService
    ),
    'file:///data/user/0/app/image.jpg'
  );
});
