import crypto from 'crypto';
import Booking from '../models/Booking.js';
import Service from '../models/Service.js';
import Therapist from '../models/Therapist.js';
import Coupon from '../models/Coupon.js';
import Setting from '../models/Setting.js';
import { serializeBooking } from '../utils/serializers.js';
import { HttpError } from '../utils/api.js';
import { getAvailableSlots, enforceNewBookingCapacity, checkSlotCapacity } from '../services/availabilityService.js';
import { createNotification } from '../services/notificationService.js';
import { sendBookingConfirmation, sendBookingStatusUpdate, sendBookingReminder, getSettings } from '../services/emailService.js';
import { logAudit } from '../services/auditService.js';
import { sendDueReminders } from '../services/reminderService.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateStr(s) {
  if (!DATE_RE.test(String(s || ''))) return false;
  const d = new Date(`${s}T12:00:00`);
  return !Number.isNaN(d.getTime());
}

function isPastDateStr(s) {
  const today = new Date();
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return String(s) < t;
}

function randomSuffix(len = 6) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len).toUpperCase();
}

async function genBookingNumber(dateStr) {
  const prefix = `AL-${String(dateStr).replace(/-/g, '')}-`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${prefix}${randomSuffix(6)}`;
    const exists = await Booking.exists({ bookingNumber: candidate });
    if (!exists) return candidate;
  }
  return `${prefix}${randomSuffix(8)}`;
}

/** Parse "HH:MM" or "hh:MM AM/PM" into minutes-since-midnight, else null. */
function slotToMinutes(slot) {
  const m = String(slot || '').trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!m) return null;
  let hh = Number(m[1]);
  const mm = Number(m[2]);
  if (m[3] === 'PM' && hh < 12) hh += 12;
  if (m[3] === 'AM' && hh === 12) hh = 0;
  if (hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

function computeCouponDiscount(coupon, amount) {
  if (!coupon) return 0;
  if (coupon.discountType === 'percent') {
    return Math.round(((amount * coupon.discount) / 100) * 100) / 100;
  }
  return Math.min(coupon.discount, amount);
}

async function getSettingsDoc() {
  return (await Setting.findOne({ key: 'default' }).lean()) || {};
}

function normalizeBookingBody(b) {
  const out = {};
  const customerName =
    b.customerName || [b.firstName, b.lastName].filter(Boolean).join(' ').trim();
  out.customerName = customerName;
  out.firstName = b.firstName || (customerName ? customerName.split(' ')[0] : '');
  out.lastName = b.lastName || (customerName ? customerName.split(' ').slice(1).join(' ') : '');
  if (b.email !== undefined) out.email = String(b.email).toLowerCase().trim();
  if (b.phone !== undefined) out.phone = b.phone;
  if (b.age !== undefined) out.age = b.age === '' || b.age == null ? null : Number(b.age);
  if (b.gender !== undefined) out.gender = b.gender;
  if (b.serviceId !== undefined) out.serviceId = b.serviceId;
  if (b.serviceTitle !== undefined) out.serviceTitle = b.serviceTitle;
  if (b.therapistId !== undefined) out.therapistId = b.therapistId;
  if (b.therapistName !== undefined) out.therapistName = b.therapistName;
  if (b.date !== undefined) out.date = b.date;
  if (b.timeSlot !== undefined) out.timeSlot = b.timeSlot;
  if (b.durationMinutes !== undefined) out.durationMinutes = Number(b.durationMinutes) || 60;
  if (b.couponCode !== undefined) out.couponCode = String(b.couponCode || '').toUpperCase().trim();
  if (b.discountAmount !== undefined) out.discountAmount = Number(b.discountAmount) || 0;
  if (b.totalPaid !== undefined) out.totalPaid = Number(b.totalPaid) || 0;
  if (b.notes !== undefined) out.notes = b.notes;
  if (b.additionalNotes !== undefined) out.notes = b.notes !== undefined ? b.notes : b.additionalNotes;
  if (b.paymentMethod !== undefined) out.paymentMethod = b.paymentMethod;
  if (b.paymentStatus !== undefined) out.paymentStatus = b.paymentStatus;
  if (b.status !== undefined) out.status = b.status;
  return out;
}

export async function createBooking(req, res) {
  const body = req.body || {};
  const data = normalizeBookingBody(body);

  if (!data.email || !EMAIL_RE.test(String(data.email))) throw new HttpError(400, 'Valid email is required');
  if (!data.phone || String(data.phone).replace(/\D/g, '').length < 7) throw new HttpError(400, 'Valid phone number is required');
  if (!data.customerName || !String(data.customerName).trim()) throw new HttpError(400, 'Full name is required');
  if (!data.date || !isValidDateStr(data.date)) throw new HttpError(400, 'Valid appointment date (YYYY-MM-DD) is required');
  if (isPastDateStr(data.date)) throw new HttpError(400, 'Appointment date cannot be in the past');
  if (!data.timeSlot || !String(data.timeSlot).trim()) throw new HttpError(400, 'Appointment time is required');

  const settings = await getSettingsDoc();
  // Honor the configurable booking horizon (default 30 days).
  const horizonDays = Number(settings.advanceBookingDays) > 0 ? Number(settings.advanceBookingDays) : 30;
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + horizonDays);
  const maxStr = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}-${String(maxDate.getDate()).padStart(2, '0')}`;
  if (String(data.date) > maxStr) {
    throw new HttpError(400, `Bookings open at most ${horizonDays} days in advance`);
  }

  // Resolve service snapshot (title + price) — server is authoritative.
  let service = null;
  if (data.serviceId && data.serviceId !== 'any') {
    try {
      service = await Service.findById(data.serviceId).lean();
    } catch { service = null; }
  }
  if (!service && data.serviceTitle) {
    service = await Service.findOne({ title: data.serviceTitle }).lean();
  }
  if (!service) throw new HttpError(400, 'Selected service is invalid');
  if (service.active === false) throw new HttpError(400, 'Selected service is not currently available');
  const serviceTitle = service.title || '';
  const servicePrice = Number(service.price) || 0;

  // Resolve therapist snapshot — never trust client-supplied name for an id.
  let therapistId = data.therapistId || 'any';
  let therapistName = '';
  if (therapistId && therapistId !== 'any') {
    let t = null;
    try { t = await Therapist.findById(therapistId).lean(); } catch { t = null; }
    if (!t) throw new HttpError(400, 'Selected therapist is invalid');
    if (t.active === false) throw new HttpError(400, 'Selected therapist is not currently available');
    therapistName = t.name || '';
  } else {
    therapistId = 'any';
    therapistName = 'Any available therapist';
  }

  // Server-side slot availability check.
  const freeSlots = await getAvailableSlots(data.date, therapistId);
  if (!freeSlots.includes(data.timeSlot)) {
    throw new HttpError(400, 'Sorry, this time slot is no longer available. Please pick another.');
  }

  // Server-side coupon validation. Usage is only consumed after the booking
  // is successfully created, so a failed booking never burns a redemption.
  let discountAmount = 0;
  let coupon = null;
  if (data.couponCode) {
    const code = String(data.couponCode).toUpperCase().trim();
    coupon = await Coupon.findOne({ code });
    if (!coupon || coupon.active === false || (coupon.expiryDate && new Date(coupon.expiryDate) < new Date())) {
      throw new HttpError(400, 'Invalid or expired coupon code');
    }
    if (coupon.minAmount && servicePrice < Number(coupon.minAmount)) {
      throw new HttpError(400, `This coupon needs a minimum order of ${coupon.minAmount}`);
    }
    if (coupon.maxUses && (coupon.usageCount || 0) >= Number(coupon.maxUses)) {
      throw new HttpError(400, 'This coupon has reached its usage limit');
    }
    discountAmount = computeCouponDiscount(coupon, servicePrice);
  }

  // Server-computed total; client totalPaid is ignored to prevent manipulation.
  const totalPaid = Math.max(0, servicePrice - discountAmount);
  const autoApprove = settings.autoApproveBookings !== false;
  const status = autoApprove ? 'confirmed' : 'pending';

  // Enforce the configurable daily cap (0/empty = unlimited).
  const maxDailyBookings = Number(settings.maxDailyBookings) > 0 ? Number(settings.maxDailyBookings) : 0;
  if (maxDailyBookings > 0) {
    const bookedToday = await Booking.countDocuments({
      date: data.date,
      status: { $nin: ['cancelled', 'rejected'] },
    });
    if (bookedToday >= maxDailyBookings) {
      throw new HttpError(400, 'This date is fully booked. Please choose another day.');
    }
  }

  // Duration is always server-derived; never trust the client value. Prefer
  // the service's own duration and use the global setting only as a fallback.
  const durationMinutes = Number(service.durationMinutes) > 0
    ? Number(service.durationMinutes)
    : Number(settings.bookingDurationMinutes) > 0
      ? Number(settings.bookingDurationMinutes)
      : 60;

  const bookingPayload = {
    ...data,
    therapistId,
    serviceId: service ? service._id : data.serviceId,
    serviceTitle,
    servicePrice,
    therapistName,
    couponCode: coupon ? coupon.code : '',
    durationMinutes,
    discountAmount,
    totalPaid,
    status,
    // Payment state is never client-controlled. Only an authenticated admin
    // action (or a verified gateway webhook, once implemented) may mark paid.
    paymentStatus: 'pending',
    paymentMethod: data.paymentMethod || 'pay_at_venue',
  };

  let booking = null;
  for (let attempt = 0; attempt < 3 && !booking; attempt += 1) {
    try {
      booking = await Booking.create({ ...bookingPayload, bookingNumber: await genBookingNumber(data.date) });
    } catch (err) {
      if (err && err.code === 11000 && attempt < 2) continue; // ref collision — retry
      throw err;
    }
  }

  // Compensating capacity check closes the check-then-insert race. Rows are
  // ordered after insert, so exactly the allowed number survives a burst.
  const capacity = await enforceNewBookingCapacity(booking._id, data.date, data.timeSlot, therapistId);
  if (!capacity.ok) {
    await booking.deleteOne();
    throw new HttpError(
      409,
      capacity.reason === 'therapist_busy'
        ? 'That therapist was just booked for this slot. Please choose another therapist or time.'
        : 'That time slot was just booked. Please choose another.'
    );
  }

  // Consume coupon usage only once the booking is safely persisted.
  if (coupon) {
    const couponFilter = coupon.maxUses
      ? { _id: coupon._id, $expr: { $lt: ['$usageCount', '$maxUses'] } }
      : { _id: coupon._id };
    const inc = await Coupon.updateOne(couponFilter, { $inc: { usageCount: 1 } });
    if (coupon.maxUses && inc.matchedCount === 0) {
      await booking.deleteOne();
      throw new HttpError(400, 'This coupon has reached its usage limit');
    }
  }

  // Fire-and-forget notifications + email (never block the response).
  createNotification({
    type: 'booking',
    title: 'New booking received',
    message: `${booking.customerName} booked ${booking.serviceTitle || 'a service'} on ${booking.date} @ ${booking.timeSlot}`,
    link: 'bookings',
  });
  getSettings().then((s) => {
    sendBookingConfirmation(s, booking.toObject()).catch(() => {});
  });
  logAudit({ action: 'create', module: 'bookings', details: `New booking ${booking.bookingNumber} from ${booking.email}`, req });

  return res.status(201).json(serializeBooking(booking.toObject()));
}

export async function listBookings(req, res) {
  const hasPaging = req.query.page !== undefined || req.query.limit !== undefined;
  if (!hasPaging) {
    const bookings = await Booking.find().sort({ createdAt: -1 }).limit(500).lean();
    return res.json(bookings.map(serializeBooking));
  }
  const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '100', 10) || 100));
  const skip = (page - 1) * limit;
  const [bookings, total] = await Promise.all([
    Booking.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Booking.countDocuments(),
  ]);
  return res.json({ data: bookings.map(serializeBooking), page, limit, total });
}

export async function lookupBooking(req, res) {
  const ref = String(req.query.q || '').trim();
  const email = String(req.query.email || '').trim().toLowerCase();

  // Ownership is ALWAYS proven with a booking reference + matching email pair.
  // There is deliberately no single-field (email/phone) fallback: that would
  // let anyone enumerate bookings and then self-service cancel/reschedule them.
  if (!ref || !email) {
    throw new HttpError(400, 'Provide both your booking reference and email address');
  }
  if (!/^AL-/i.test(ref)) {
    throw new HttpError(400, 'Enter your booking reference (e.g. AL-20260101-ABC123) and email address');
  }

  const booking = await Booking.findOne({ bookingNumber: ref, email }).lean();
  if (!booking) throw new HttpError(404, 'No booking found');
  return res.json(serializeBooking(booking));
}

async function findOwnedBooking(bookingNumber, email) {
  const ref = String(bookingNumber || '').trim();
  const em = String(email || '').toLowerCase().trim();
  if (!ref || !em) throw new HttpError(400, 'Booking reference and email are required');
  const booking = await Booking.findOne({ bookingNumber: ref, email: em });
  if (!booking) throw new HttpError(404, 'No booking found for those details');
  return booking;
}

/**
 * Public self-service cancellation (no session). Ownership proven via
 * booking reference + email pair. Only pending/confirmed bookings.
 */
export async function publicCancelBooking(req, res) {
  const booking = await findOwnedBooking(req.body && req.body.bookingNumber, req.body && req.body.email);
  if (!['pending', 'confirmed'].includes(booking.status)) {
    throw new HttpError(400, `This booking is already ${booking.status}`);
  }

  // Enforce the configured cancellation notice window.
  const config = await getSettingsDoc();
  const noticeHours = Number(config.cancellationNoticeHours) >= 0 ? Number(config.cancellationNoticeHours) : 4;
  if (noticeHours > 0) {
    const minutes = slotToMinutes(booking.timeSlot);
    if (minutes !== null) {
      const appt = new Date(`${booking.date}T00:00:00`);
      appt.setMinutes(appt.getMinutes() + minutes);
      const cutoff = appt.getTime() - noticeHours * 60 * 60 * 1000;
      if (Date.now() > cutoff) {
        throw new HttpError(
          400,
          `Bookings must be cancelled at least ${noticeHours} hour(s) before the appointment. Please contact us directly.`
        );
      }
    }
  }

  const reason = String((req.body && req.body.reason) || 'Cancelled by client').slice(0, 500);
  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancelledReason = reason;
  await booking.save();

  createNotification({
    type: 'cancellation',
    title: 'Booking cancelled (self-service)',
    message: `${booking.customerName} — booking ${booking.bookingNumber} was cancelled.`,
    link: 'bookings',
  });
  getSettings().then((s) => {
    sendBookingStatusUpdate(s, booking.toObject()).catch(() => {});
  });
  return res.json(serializeBooking(booking.toObject()));
}

/**
 * Public self-service reschedule (no session). Validates the new slot
 * against live availability so guests can never double-book.
 */
export async function publicRescheduleBooking(req, res) {
  const booking = await findOwnedBooking(req.body && req.body.bookingNumber, req.body && req.body.email);
  if (!['pending', 'confirmed'].includes(booking.status)) {
    throw new HttpError(400, `This booking is already ${booking.status}`);
  }
  const date = String((req.body && req.body.date) || '').trim();
  const timeSlot = String((req.body && req.body.timeSlot) || '').trim();
  if (!isValidDateStr(date)) throw new HttpError(400, 'Valid date (YYYY-MM-DD) is required');
  if (isPastDateStr(date)) throw new HttpError(400, 'Date cannot be in the past');
  if (!timeSlot) throw new HttpError(400, 'Time slot is required');
  try {
    const s = await getSettingsDoc();
    const horizon = Number(s.advanceBookingDays) > 0 ? Number(s.advanceBookingDays) : 30;
    const max = new Date();
    max.setDate(max.getDate() + horizon);
    const maxS = `${max.getFullYear()}-${String(max.getMonth() + 1).padStart(2, '0')}-${String(max.getDate()).padStart(2, '0')}`;
    if (date > maxS) throw new HttpError(400, `Bookings open at most ${horizon} days in advance`);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    /* horizon check is best-effort if settings are unreadable */
  }

  let therapistId = (req.body && req.body.therapistId) || booking.therapistId || 'any';
  let therapistName = booking.therapistName || '';
  if (therapistId && therapistId !== 'any') {
    let t = null;
    try { t = await Therapist.findById(therapistId).lean(); } catch { t = null; }
    if (!t) throw new HttpError(400, 'Selected therapist is invalid');
    if (t.active === false) throw new HttpError(400, 'Selected therapist is not currently available');
    therapistName = t.name || '';
  } else {
    therapistId = 'any';
    therapistName = 'Any available therapist';
  }

  const sameSlot = date === booking.date && timeSlot === booking.timeSlot && String(therapistId) === String(booking.therapistId || 'any');
  if (!sameSlot) {
    const free = await getAvailableSlots(date, String(therapistId), booking._id);
    if (!free.includes(timeSlot)) {
      throw new HttpError(400, 'Sorry, this time slot is no longer available. Please pick another.');
    }
  }

  const previous = {
    date: booking.date,
    timeSlot: booking.timeSlot,
    therapistId: booking.therapistId,
    therapistName: booking.therapistName,
  };
  booking.date = date;
  booking.timeSlot = timeSlot;
  booking.therapistId = therapistId;
  booking.therapistName = therapistName;
  await booking.save();

  if (!sameSlot) {
    const capacity = await checkSlotCapacity(date, timeSlot, therapistId, booking._id);
    if (!capacity.ok) {
      Object.assign(booking, previous);
      await booking.save();
      throw new HttpError(
        409,
        capacity.reason === 'therapist_busy'
          ? 'That therapist was just booked for this slot. Please choose another therapist or time.'
          : 'That time slot was just booked. Please choose another.'
      );
    }
  }

  createNotification({
    type: 'booking',
    title: 'Booking rescheduled (self-service)',
    message: `${booking.customerName} moved ${booking.bookingNumber} to ${date} @ ${timeSlot}.`,
    link: 'bookings',
  });
  await logAudit({ action: 'reschedule', module: 'bookings', details: `Self-service reschedule ${booking.bookingNumber}`, req });
  return res.json(serializeBooking(booking.toObject()));
}

export async function updateBooking(req, res) {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new HttpError(404, 'Booking not found');

  const data = normalizeBookingBody(req.body || {});
  const prevStatus = booking.status;
  const nowCancelled = data.status === 'cancelled' || data.status === 'rejected';
  const wasCancelled = prevStatus === 'cancelled' || prevStatus === 'rejected';

  if (nowCancelled && !wasCancelled) {
    booking.cancelledAt = new Date();
    booking.cancelledReason = data.notes || req.body.cancelledReason || '';
  }

  // Admin updates must not silently change money/identity without revalidation.
  delete data.totalPaid;
  delete data.discountAmount;
  delete data.servicePrice;
  delete data.email;

  // Payment state is privileged: Receptionists (and any future lower role)
  // must never be able to mark a booking paid/refunded.
  if (data.paymentStatus !== undefined && data.paymentStatus !== booking.paymentStatus) {
    if (!['Super Admin', 'Admin', 'Manager'].includes(req.user.role)) {
      throw new HttpError(403, 'You do not have permission to change payment status');
    }
    if (!['pending', 'completed', 'refunded'].includes(data.paymentStatus)) {
      throw new HttpError(400, 'Invalid payment status');
    }
  }

  const nextDate = data.date !== undefined ? data.date : booking.date;
  const nextSlot = data.timeSlot !== undefined ? data.timeSlot : booking.timeSlot;
  const nextTherapist = data.therapistId !== undefined
    ? String(data.therapistId).trim() || 'any'
    : String(booking.therapistId || 'any');
  if (data.therapistId !== undefined) data.therapistId = nextTherapist;
  const therapistChanged = nextTherapist !== String(booking.therapistId || 'any');

  if (!isValidDateStr(nextDate)) throw new HttpError(400, 'Invalid date');

  if (therapistChanged && nextTherapist !== 'any') {
    let t = null;
    try { t = await Therapist.findById(nextTherapist).lean(); } catch { t = null; }
    if (!t) throw new HttpError(400, 'Selected therapist is invalid');
    if (t.active === false) throw new HttpError(400, 'Selected therapist is not currently available');
  }

  const slotChanged = nextDate !== booking.date || nextSlot !== booking.timeSlot || therapistChanged;

  // Revalidate availability whenever the slot or therapist changes. Excluding
  // this booking prevents it from blocking its own reschedule.
  if (slotChanged) {
    const slots = await getAvailableSlots(nextDate, nextTherapist, booking._id);
    if (!slots.includes(nextSlot)) {
      throw new HttpError(400, 'Requested slot is not available');
    }
  }

  const previous = {
    date: booking.date,
    timeSlot: booking.timeSlot,
    therapistId: booking.therapistId,
    therapistName: booking.therapistName,
  };
  Object.assign(booking, data);
  await booking.save();

  // Re-check after the write and roll back on a concurrent overbooking.
  if (slotChanged && !['cancelled', 'rejected'].includes(booking.status)) {
    const capacity = await checkSlotCapacity(booking.date, booking.timeSlot, booking.therapistId, booking._id);
    if (!capacity.ok) {
      Object.assign(booking, previous);
      await booking.save();
      throw new HttpError(
        409,
        capacity.reason === 'therapist_busy'
          ? 'That therapist is already booked for this slot. Please choose another.'
          : 'That time slot is already full. Please choose another.'
      );
    }
  }

  const statusChanged = data.status && data.status !== prevStatus;
  if (statusChanged) {
    if (booking.status === 'cancelled') {
      createNotification({
        type: 'cancellation',
        title: 'Booking cancelled',
        message: `${booking.customerName} — booking ${booking.bookingNumber} was ${booking.status}.`,
        link: 'bookings',
      });
    }
    if (['confirmed', 'completed', 'cancelled', 'rejected'].includes(booking.status)) {
      getSettings().then((s) => {
        sendBookingStatusUpdate(s, booking.toObject()).catch(() => {});
      });
    }
  }

  await logAudit({ action: 'update', module: 'bookings', details: `Updated booking ${booking.bookingNumber}`, req });
  return res.json(serializeBooking(booking.toObject()));
}

export async function deleteBooking(req, res) {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new HttpError(404, 'Booking not found');

  await booking.deleteOne();
  await logAudit({ action: 'delete', module: 'bookings', details: `Deleted booking ${booking.bookingNumber}`, req });
  return res.json({ success: true });
}

export async function sendReminder(req, res) {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new HttpError(404, 'Booking not found');
  if (['cancelled', 'rejected', 'completed'].includes(booking.status)) {
    throw new HttpError(400, `Cannot send reminders for ${booking.status} bookings`);
  }

  const settings = await getSettings();
  const result = await sendBookingReminder(settings, booking.toObject());
  if (!result.success) throw new HttpError(500, 'Reminder could not be sent');

  booking.reminderSentAt = new Date();
  await booking.save();

  await logAudit({ action: 'reminder', module: 'bookings', details: `Sent reminder for ${booking.bookingNumber}`, req });
  return res.json({ success: true, message: 'Reminder sent successfully' });
}

export async function triggerReminders(req, res) {
  const { sentCount, failedCount, date } = await sendDueReminders({ req });
  return res.json({
    success: true,
    message: `${sentCount} reminder${sentCount === 1 ? '' : 's'} sent${failedCount ? `, ${failedCount} failed` : ''}`,
    data: { sentCount, failedCount, date },
  });
}

export default { createBooking, listBookings, lookupBooking, publicCancelBooking, publicRescheduleBooking, updateBooking, deleteBooking, sendReminder, triggerReminders };