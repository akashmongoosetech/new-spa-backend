import Booking from '../models/Booking.js';
import { sendBookingReminder, getSettings } from './emailService.js';
import { logAudit } from './auditService.js';
import { localDateOffset } from '../utils/dates.js';

/**
 * Send reminders for tomorrow's confirmed/pending bookings.
 *
 * Each booking is claimed atomically (reminderSentAt set) before sending, so
 * multiple API instances or a concurrent manual trigger cannot double-send.
 * If delivery fails, the claim is released so the next run can retry.
 */
export async function sendDueReminders({ req = null, targetDate = null } = {}) {
  const date = targetDate || localDateOffset(1);
  const bookings = await Booking.find({
    date,
    status: { $in: ['confirmed', 'pending'] },
    reminderSentAt: null,
    email: { $ne: '' },
  }).lean();

  if (bookings.length === 0) {
    return { sentCount: 0, failedCount: 0, date };
  }

  const settings = await getSettings();
  let sentCount = 0;
  let failedCount = 0;

  for (const b of bookings) {
    const claimed = await Booking.findOneAndUpdate(
      { _id: b._id, reminderSentAt: null },
      { $set: { reminderSentAt: new Date() } },
      { new: false }
    ).lean();
    if (!claimed) continue; // another worker already handled it

    try {
      const result = await sendBookingReminder(settings, b);
      if (result.success) sentCount += 1;
      else {
        failedCount += 1;
        await Booking.updateOne({ _id: b._id }, { $set: { reminderSentAt: null } });
      }
    } catch {
      failedCount += 1;
      await Booking.updateOne({ _id: b._id }, { $set: { reminderSentAt: null } });
    }
  }

  await logAudit({
    action: 'reminders',
    module: 'bookings',
    details: `Auto-sent ${sentCount} reminder(s) for ${date}${failedCount ? `; ${failedCount} failed` : ''}`,
    req,
  });

  return { sentCount, failedCount, date };
}

export default { sendDueReminders };
