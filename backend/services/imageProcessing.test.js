const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { createImageVariants } = require('./imageProcessing');

test('creates compressed WebP variants without enlarging small source images', async () => {
  const original = await sharp({
    create: { width: 1600, height: 900, channels: 3, background: '#777' },
  }).jpeg().toBuffer();
  const result = await createImageVariants(original);

  assert.deepEqual(Object.keys(result.variants), ['tiny', 'small', 'medium', 'large']);
  assert.equal(result.width, 1600);
  assert.equal(result.height, 900);
  assert.ok(result.variants.tiny.width <= 64);
  assert.ok(result.variants.small.width <= 240);
  assert.ok(result.variants.medium.width <= 640);
  assert.ok(result.variants.large.width <= 1080);
  assert.ok(result.variants.large.fileSize < original.length);
  assert.equal(result.variants.medium.mimeType, 'image/webp');
});

test('does not upscale images smaller than the smallest variant', async () => {
  const original = await sharp({
    create: { width: 48, height: 32, channels: 3, background: '#777' },
  }).jpeg().toBuffer();
  const result = await createImageVariants(original);

  assert.deepEqual(result.variants, {});
  assert.equal(result.width, 48);
  assert.equal(result.height, 32);
});

test('creates a large variant at source resolution when the source is below 1080px', async () => {
  const original = await sharp({
    create: { width: 900, height: 600, channels: 3, background: '#777' },
  }).jpeg().toBuffer();
  const result = await createImageVariants(original);

  assert.equal(result.variants.large.width, 900);
  assert.equal(result.variants.large.height, 600);
});

test('uses the source resolution for the highest relevant variant without upscaling', async () => {
  const original = await sharp({
    create: { width: 300, height: 200, channels: 3, background: '#777' },
  }).jpeg().toBuffer();
  const result = await createImageVariants(original);

  assert.equal(result.variants.medium.width, 300);
  assert.equal(result.variants.medium.height, 200);
  assert.equal(result.variants.large, undefined);
});
