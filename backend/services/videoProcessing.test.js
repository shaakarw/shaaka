const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const ffmpegPath = require('ffmpeg-static');
const Post = require('../models/Post');
const { processVideoBuffer, readVideoDuration } = require('./videoProcessing');

let fixtureBuffer;
let fixtureDirectory;

before(async () => {
  fixtureDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'shaaka-video-test-'));
  const fixturePath = path.join(fixtureDirectory, 'valid.mp4');
  execFileSync(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=15',
    '-t', '3',
    '-c:v', 'mpeg4',
    '-pix_fmt', 'yuv420p',
    fixturePath,
  ], { windowsHide: true });
  fixtureBuffer = await fs.readFile(fixturePath);
});

after(async () => {
  if (fixtureDirectory) await fs.rm(fixtureDirectory, { recursive: true, force: true });
});

test('validates actual video duration and produces a compressed JPEG cover', async () => {
  const result = await processVideoBuffer(fixtureBuffer);
  assert.ok(Number.isFinite(result.duration) && Math.abs(result.duration - 3) <= 0.1);
  assert.ok(result.thumbnailBuffer.length > 3 && result.thumbnailBuffer.length <= 3 * 1024 * 1024);
  assert.deepEqual([...result.thumbnailBuffer.subarray(0, 3)], [0xff, 0xd8, 0xff]);
});

test('rejects unreadable video data before returning a cover', async () => {
  await assert.rejects(
    processVideoBuffer(Buffer.from('not a video')),
    error => error.statusCode === 400 && /readable duration/.test(error.message)
  );
});

test('allows concurrent video processing and retry after an unreadable upload', async () => {
  await assert.rejects(processVideoBuffer(Buffer.from('not a video')));

  const [first, second] = await Promise.all([
    processVideoBuffer(fixtureBuffer),
    processVideoBuffer(fixtureBuffer),
  ]);
  assert.equal(first.duration, second.duration);
  assert.ok(first.thumbnailBuffer.length > 0);
  assert.ok(second.thumbnailBuffer.length > 0);
});

test('reads short, long, and fractional durations from common video formats', async () => {
  const fixtures = [
    { extension: 'mp4', duration: 1, codec: 'mpeg4' },
    { extension: 'mp4', duration: 2, codec: 'mpeg4' },
    { extension: 'mp4', duration: 3, codec: 'mpeg4' },
    { extension: 'mp4', duration: 3.2, codec: 'mpeg4' },
    { extension: 'mp4', duration: 10, codec: 'mpeg4' },
    { extension: 'mp4', duration: 30, codec: 'mpeg4' },
    { extension: 'mp4', duration: 65, codec: 'mpeg4' },
    { extension: 'mov', duration: 3, codec: 'mpeg4' },
    { extension: 'webm', duration: 3, codec: 'libvpx' },
  ];

  for (const fixture of fixtures) {
    const fixturePath = path.join(
      fixtureDirectory,
      `duration-${fixture.duration}.${fixture.extension}`
    );
    const ffmpegArgs = [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'testsrc2=size=128x96:rate=5',
      '-t', String(fixture.duration),
      '-an',
      '-c:v', fixture.codec,
      '-pix_fmt', 'yuv420p',
    ];
    if (fixture.codec === 'libvpx') {
      ffmpegArgs.push('-deadline', 'realtime', '-cpu-used', '8', '-crf', '40', '-b:v', '0');
    }
    ffmpegArgs.push(fixturePath);
    execFileSync(ffmpegPath, ffmpegArgs, { windowsHide: true });

    const extractedDuration = await readVideoDuration(fixturePath);
    assert.ok(
      Math.abs(extractedDuration - fixture.duration) <= 0.1,
      `${fixture.extension} duration ${fixture.duration}s was read as ${extractedDuration}s`
    );
  }
});

test('stores video duration in the Post model as a numeric number of seconds', () => {
  const post = new Post({ videoDuration: 3.02 });
  assert.equal(Post.schema.path('videoDuration').instance, 'Number');
  assert.equal(post.videoDuration, 3.02);
});
