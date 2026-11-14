const assert = require('node:assert/strict');
const { test } = require('node:test');

process.env.TURSO_DATABASE_URL = 'file::memory:';
process.env.TURSO_AUTH_TOKEN = 'cron-test';

const connectDB = require('./config/db');
const User = require('./models/User');
const {
  initCronJobs,
  runDailyReset,
  runAutoDelete,
  runExpiredImageCleanup,
  runPlanExpiry,
} = require('./cron');

test('scheduled jobs initialize once, can be stopped, and existing jobs still run', async () => {
  const database = await connectDB();
  let stop;
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const user = await User.create({
      phone: 'cron-test-user',
      username: 'cron-test-user',
      idNumber: 'cron-test-id',
      password: 'test-password',
      dailyMessagesUsed: 7,
      messagesLastReset: yesterday,
    });

    stop = initCronJobs({ initialDelayMs: 60_000 });
    assert.equal(initCronJobs({ initialDelayMs: 60_000 }), stop);
    stop();

    await runDailyReset();
    const resetUser = await User.findById(user._id);
    assert.equal(resetUser.dailyMessagesUsed, 0);
    assert.ok(new Date(resetUser.messagesLastReset) >= new Date(Date.now() - 10_000));

    await runAutoDelete();
    await runExpiredImageCleanup();
    await runPlanExpiry();
  } finally {
    if (stop) stop();
    await connectDB.closeDB();
  }
});
