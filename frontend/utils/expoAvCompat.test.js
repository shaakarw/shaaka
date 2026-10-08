const test = require('node:test');
const assert = require('node:assert/strict');

const modulePath = './expoAvCompat';

test('expoAvCompat exposes safe Audio and Video fallbacks', async () => {
  const compat = require(modulePath);

  assert.ok(compat.Audio && compat.Audio.Sound, 'Audio.Sound should exist');
  assert.ok(typeof compat.Video === 'function', 'Video should be a renderable component');
  assert.ok(compat.ResizeMode, 'ResizeMode should exist');

  const safeSound = compat.Audio.Sound;
  const created = await safeSound.createAsync({ uri: 'https://example.com/test.mp3' });
  assert.ok(created && created.sound, 'fallback sound object should be created');
  assert.equal(typeof created.sound.playAsync, 'function', 'sound should support playAsync');
});
