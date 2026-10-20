import logger from '../utils/logger.js';
import { sendDueReminders } from './reminderService.js';

const INTERVAL_MS = 60 * 60 * 1000; // hourly

/**
 * Run the reminder job hourly. It is idempotent: only bookings for tomorrow
 * that have not been reminded yet are picked up. Disable with
 * REMINDER_SCHEDULER=false (e.g. when a separate worker owns the job).
 */
export function startReminderScheduler() {
  if (process.env.REMINDER_SCHEDULER === 'false') {
    logger.info('reminders', 'Scheduler disabled via REMINDER_SCHEDULER=false');
    return () => {};
  }

  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const result = await sendDueReminders();
      if (result.sentCount || result.failedCount) {
        logger.info(
          'reminders',
          `Reminder run for ${result.date}: ${result.sentCount} sent, ${result.failedCount} failed`
        );
      }
    } catch (err) {
      logger.error('reminders', 'Scheduled reminder run failed', err);
    } finally {
      running = false;
    }
  };

  // Small delay after boot so DB/HTTP listeners are fully ready.
  const initial = setTimeout(run, 15_000);
  if (typeof initial.unref === 'function') initial.unref();
  const timer = setInterval(run, INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();

  return () => {
    clearTimeout(initial);
    clearInterval(timer);
  };
}

export default { startReminderScheduler };
