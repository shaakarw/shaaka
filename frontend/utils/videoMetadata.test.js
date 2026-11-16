const test = require('node:test');
const assert = require('node:assert/strict');

const { getVideoMetaData, validateVideoMetadata } = require('./videoMetadata');

test('reads picker video metadata and converts duration from milliseconds', () => {
  const metadata = getVideoMetaData({
    duration: 125000,
    width: 1080,
    height: 1920,
    fileName: 'clip.MOV',
    mimeType: 'video/quicktime',
  });

  assert.deepEqual(metadata, {
    duration: 125,
    width: 1080,
    height: 1920,
    extension: 'mov',
  });
});

test('uses the MIME type when the picker does not provide a file name', () => {
  assert.equal(getVideoMetaData({
    duration: 1000,
    width: 640,
    height: 480,
    mimeType: 'video/mp4',
  }).extension, 'mp4');
});

test('rejects missing duration or dimensions', () => {
  assert.throws(() => validateVideoMetadata({ width: 640, height: 480 }), /readable duration/);
  assert.throws(() => validateVideoMetadata({ duration: 1, width: 0, height: 480 }), /dimensions/);
});
