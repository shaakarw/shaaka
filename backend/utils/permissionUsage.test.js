const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_USER_PERMISSIONS } = require('../config/userPermissions');
const {
  getKigaliDate,
  getNextDailyReset,
} = require('./permissionUsage');
const { isExpired } = require('./messageRetention');

test('new user defaults match the supported permission values', () => {
  assert.deepEqual(DEFAULT_USER_PERMISSIONS, {
    postUploadLimitPerDay: 4,
    shopUploadLimitLifetime: 1,
    placeProductUploadLimitPerDay: 4,
    mallShopUploadLimitLifetime: 1,
    mallProductUploadLimitPerDay: 4,
    imagesPerMessage: 18,
    imagesRetentionDays: 15,
    messagesRetentionDays: 30,
    videoUploadLimitPerDay: 1,
  });
});

test('daily usage is keyed to the Kigali calendar day', () => {
  assert.equal(getKigaliDate(new Date('2026-11-12T21:59:59.000Z')), '2026-11-12');
  assert.equal(getKigaliDate(new Date('2026-11-12T22:00:00.000Z')), '2026-11-13');
});

test('daily quota reset is midnight in Kigali, including the boundary', () => {
  assert.equal(
    getNextDailyReset(new Date('2026-11-12T21:59:59.000Z')).toISOString(),
    '2026-11-12T22:00:00.000Z'
  );
  assert.equal(
    getNextDailyReset(new Date('2026-11-12T22:00:00.000Z')).toISOString(),
    '2026-11-13T22:00:00.000Z'
  );
});

test('retention keeps media/messages through the configured period', () => {
  const now = new Date('2026-11-13T12:00:00.000Z');
  assert.equal(isExpired('2026-10-29T12:00:00.000Z', 15, now), false);
  assert.equal(isExpired('2026-10-29T11:59:59.999Z', 15, now), true);
  assert.equal(isExpired('2026-10-14T11:59:59.999Z', 30, now), true);
});
