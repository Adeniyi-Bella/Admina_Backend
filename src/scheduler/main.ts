/**
 * @copyright 2025 Adeniyi Bella
 * Scheduler Entry Point
 */
import "reflect-metadata"
import { connectToDatabase, disconnectFromDatabase } from '@/lib/mongoose';
import { DataCleanupService } from './DataCleanupService';
import { UserDeleteService } from './UserDeleteService';
import { schedulerLogger as logger } from './logger';
import { NotificationService } from '@/services/notifications/notification.service';

async function runScheduler() {
  const context = 'Scheduler-Job';
  const startTime = Date.now();
  await connectToDatabase(context);

  try {
    const cleanup = new DataCleanupService();
    const notify = new NotificationService();
    const purge = new UserDeleteService();

    logger.info('--- Beginning Daily Lifecycle Tasks ---');

    const cleanedCount = await cleanup.execute();
    const purgeStats = await purge.execute();
    await notify.catchUpFailedWelcomeEmails();
    const emailStats = await notify.processDailyReminders();
    // Now returns an object

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const emailSuccessRate =
      emailStats.total > 0
        ? ((emailStats.success / emailStats.total) * 100).toFixed(2)
        : '100';

    // NEW: Calculate Purge success rate for the summary
    const purgeSuccessRate =
      purgeStats.total > 0
        ? ((purgeStats.purged / purgeStats.total) * 100).toFixed(2)
        : '100';

    logger.info(`
================================================
SCHEDULER SUMMARY - ${new Date().toLocaleDateString()}
------------------------------------------------
Duration:        ${duration}s
Cleanup (Docs):  ${cleanedCount} users processed
Purged (Total):  ${purgeStats.purged}/${purgeStats.total} removed (${purgeSuccessRate}%)
Purge Failed:    ${purgeStats.failed} users (See logs for details)
Email Success:   ${emailSuccessRate}% (${emailStats.success}/${emailStats.total})
================================================`);

    // OPTIONAL: If you want main.ts to "fail" the process if ANY user failed to purge
    if (purgeStats.failed > 0 || emailStats.failed > 0) {
      logger.warn(
        'Scheduler finished with partial failures. Check logs/scheduler.log',
      );
    }
  } catch (err) {
    logger.error('CRITICAL ERROR IN SCHEDULER:', err);
  } finally {
    await disconnectFromDatabase('Scheduler');
    process.exit(0);
  }
}

// Execute the job
runScheduler();
