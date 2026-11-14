// backend/cron.js
// Cron jobs for daily reset, auto-delete messages, and plan expiry

const User = require('./models/User');
const { cleanupExpiredMessageImages, cleanupOldMessages } = require('./utils/messageRetention');
const { processPendingNotifications } = require('./services/pushNotificationService');

/**
 * 1. Daily Reset Cron Job
 * Resets dailyMessagesUsed = 0 for users whose messagesLastReset is before today.
 */
const runDailyReset = async () => {
  console.log('[Cron] Running daily reset check...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const result = await User.updateMany(
      { messagesLastReset: { $lt: today } },
      { $set: { dailyMessagesUsed: 0, messagesLastReset: new Date() } }
    );
    if (result.modifiedCount > 0) {
      console.log(`[Cron] Reset dailyMessagesUsed for ${result.modifiedCount} user(s)`);
    } else {
      console.log('[Cron] No users needed daily reset.');
    }
  } catch (error) {
    console.error('[Cron] Daily reset error:', error);
  }
};

/**
 * 2. Auto-Delete Cron Job
 * Deletes messages and their media after the fixed 30-day retention period.
 */
const runAutoDelete = async () => {
  console.log('[Cron] Running auto-delete check...');

  try {
    const result = await cleanupOldMessages();
    if (result.totalMessagesDeleted > 0 || result.totalAssetsFailed > 0) {
      console.log(
        `[Cron] Expired message cleanup: ${result.totalMessagesDeleted} message(s) deleted, `
        + `${result.totalAssetsFailed} asset deletion(s) failed`
      );
    } else {
      console.log('[Cron] No messages expired.');
    }
  } catch (error) {
    console.error('[Cron] Auto-delete error:', error);
  }
};

const runExpiredImageCleanup = async () => {
  console.log('[Cron] Running expired message image cleanup...');

  try {
    const result = await cleanupExpiredMessageImages();
    if (result.totalImagesDeleted > 0 || result.totalAssetsFailed > 0) {
      console.log(
        `[Cron] Expired message image cleanup: ${result.totalImagesDeleted} image(s) removed, `
        + `${result.totalAssetsFailed} asset operation(s) failed`
      );
    } else {
      console.log('[Cron] No message images expired.');
    }
  } catch (error) {
    console.error('[Cron] Expired image cleanup error:', error);
  }
};

/**
 * 3. Plan Expiry Cron Job
 * Finds users whose planStartDate is more than 30 days ago
 * and downgrades them to 'free'.
 */
const runPlanExpiry = async () => {
  console.log('[Cron] Running plan expiry check...');

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const expiredUsers = await User.find({
      plan: { $ne: 'free' },
      planStartDate: { $lt: thirtyDaysAgo },
    });

    let downgradedCount = 0;
    for (const user of expiredUsers) {
      // Check if user has any active payment that extends beyond 30 days
      const now = new Date();
      const hasActivePayment = (user.paymentHistory || []).some(
        p => p.status === 'success' && p.expiryDate && new Date(p.expiryDate) > now
      );

      if (!hasActivePayment) {
        user.plan = 'free';
        user.planName = 'Free';
        user.planExpiry = null;
        user.subscriptionStatus = 'active';
        user.dailyMessagesUsed = 0;
        user.messagesLastReset = new Date();
        await user.save();
        downgradedCount++;

        console.log(`[Cron] Downgraded user ${user._id} (${user.username}) to free plan`);

        // (Optional) Send a notification – could be extended here
      }
    }

    if (downgradedCount > 0) {
      console.log(`[Cron] Downgraded ${downgradedCount} user(s) to free plan`);
    } else {
      console.log('[Cron] No users to downgrade.');
    }
  } catch (error) {
    console.error('[Cron] Plan expiry error:', error);
  }
};

/**
 * Initialize all cron jobs.
 * Runs immediately on startup and then every hour.
 */
const initCronJobs = ({ initialDelayMs = 0 } = {}) => {
  console.log('[Cron] Initializing cron jobs...');

  const startJobs = () => {
    runDailyReset();
    runAutoDelete();
    runExpiredImageCleanup();
    runPlanExpiry();
    processPendingNotifications().catch(error => {
      console.error('[Cron] Push notification queue error:', error);
    });

    const HOUR_IN_MS = 60 * 60 * 1000;
    setInterval(runDailyReset, HOUR_IN_MS);
    setInterval(runAutoDelete, HOUR_IN_MS);
    setInterval(runExpiredImageCleanup, HOUR_IN_MS);
    setInterval(runPlanExpiry, HOUR_IN_MS);
    setInterval(() => {
      processPendingNotifications().catch(error => {
        console.error('[Cron] Push notification queue error:', error);
      });
    }, 60 * 1000);
  };

  if (initialDelayMs > 0) setTimeout(startJobs, initialDelayMs);
  else startJobs();

  console.log('[Cron] Cron jobs scheduled (every hour).');
};

module.exports = {
  initCronJobs,
  runDailyReset,
  runAutoDelete,
  runExpiredImageCleanup,
  runPlanExpiry,
};
