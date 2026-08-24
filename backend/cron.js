// backend/cron.js
// Cron jobs for daily reset, auto-delete messages, and plan expiry

const User = require('./models/User');
const Message = require('./models/Message');
const cloudinary = require('./config/cloudinary');

const PLAN_FEATURES = {
  basic: { retentionDays: 7 },
  standard: { retentionDays: 8 },
  premium: { retentionDays: 10 },
  enterprise: { retentionDays: 15 },
};

const FREE_RETENTION_DAYS = 4;

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
 * Deletes message images older than the user's tier retention period.
 * Since we don't store the tier on each message, we find messages
 * with imageUrl older than the maximum possible retention (15 days)
 * and check each message's sender's current tier.
 */
const runAutoDelete = async () => {
  console.log('[Cron] Running auto-delete check...');

  try {
    // Find the oldest possible retention across all tiers
    const maxRetention = Math.max(
      FREE_RETENTION_DAYS,
      ...Object.values(PLAN_FEATURES).map(f => f.retentionDays)
    );
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxRetention);

    const oldMessages = await Message.find({
      imageUrl: { $exists: true, $ne: '' },
      createdAt: { $lt: cutoff },
    }).populate('senderId', 'paymentHistory');

    let deletedCount = 0;
    for (const msg of oldMessages) {
      const sender = msg.senderId;
      if (!sender) {
        // No sender found, delete after max retention
        await Message.findByIdAndDelete(msg._id);
        deletedCount++;
        continue;
      }

      // Determine retention days for this user at the time of upload
      // We use the message's createdAt to check which payments were active then
      const msgDate = msg.createdAt || cutoff;
      const activePayments = (sender.paymentHistory || []).filter(
        p => p.status === 'success' && p.expiryDate && new Date(p.expiryDate) > msgDate
      );

      let retentionDays = FREE_RETENTION_DAYS;
      activePayments.forEach(p => {
        const features = PLAN_FEATURES[p.plan];
        if (features && features.retentionDays > retentionDays) {
          retentionDays = features.retentionDays;
        }
      });

      const msgCutoff = new Date(msgDate);
      msgCutoff.setDate(msgCutoff.getDate() + retentionDays);

      if (new Date() > msgCutoff) {
        // Delete from Cloudinary if URL exists
        if (msg.imageUrl && msg.imageUrl.includes('cloudinary')) {
          try {
            const publicId = msg.imageUrl.split('/').pop().split('.')[0];
            if (publicId) {
              await cloudinary.uploader.destroy(`chat_images/${publicId}`);
            }
          } catch (cloudErr) {
            console.warn(`[Cron] Cloudinary delete warning for ${msg._id}:`, cloudErr.message);
          }
        }
        await Message.findByIdAndDelete(msg._id);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`[Cron] Deleted ${deletedCount} old message image(s)`);
    } else {
      console.log('[Cron] No old messages to delete.');
    }
  } catch (error) {
    console.error('[Cron] Auto-delete error:', error);
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
const initCronJobs = () => {
  console.log('[Cron] Initializing cron jobs...');

  // Run immediately on startup
  runDailyReset();
  runAutoDelete();
  runPlanExpiry();

  // Run every hour
  const HOUR_IN_MS = 60 * 60 * 1000;
  setInterval(runDailyReset, HOUR_IN_MS);
  setInterval(runAutoDelete, HOUR_IN_MS);
  setInterval(runPlanExpiry, HOUR_IN_MS);

  console.log('[Cron] Cron jobs scheduled (every hour).');
};

module.exports = { initCronJobs, runDailyReset, runAutoDelete, runPlanExpiry };
