import Booking from '../models/Booking.js';
import Service from '../models/Service.js';
import Therapist from '../models/Therapist.js';
import Coupon from '../models/Coupon.js';
import Setting from '../models/Setting.js';
import { serializeBooking } from '../utils/serializers.js';
import { HttpError } from '../utils/api.js';
import { getAvailableSlots } from '../services/availabilityService.js';
import { createNotification } from '../services/notificationService.js';
import { sendBookingConfirmation, sendBookingStatusUpdate, sendBookingReminder, getSettings } from '../services/emailService.js';
import { logAudit } from '../services/auditService.js';

async function genBookingNumber(dateStr) {
  const prefix = `AL-${String(dateStr).replace(/-/g, '')}-`;
  const count = await Booking.countDocuments({ bookingNumber: new RegExp(`^${prefix}`) });
  const seq = String(count + 1).padStart(3, '0');
  return `${prefix}${seq}`;
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
  if (b.additionalNotes !== undefined) out.notes = b.notes ?? b.additionalNotes;
  if (b.paymentMethod !== undefined) out.paymentMethod = b.paymentMethod;
  if (b.paymentStatus !== undefined) out.paymentStatus = b.paymentStatus;
  if (b.status !== undefined) out.status = b.status;
  return out;
}

export async function createBooking(req, res) {
  const body = req.body || {};
  const data = normalizeBookingBody(body);

  if (!data.email) throw new HttpError(400, 'Email is required');
  if (!data.date) throw new HttpError(400, 'Appointment date is required');
  if (!data.timeSlot) throw new HttpError(400, 'Appointment time is required');

  const settings = await getSettingsDoc();

  // Resolve service snapshot (title + price).
  let service = null;
  if (data.serviceId && data.serviceId !== 'any') {
    service = await Service.findById(data.serviceId).lean();
  }
  if (!service && data.serviceTitle) {
    service = await Service.findOne({ title: data.serviceTitle }).lean();
  }
  const serviceTitle = data.serviceTitle || (service && service.title) || '';
  const servicePrice = (service && service.price) || Number(data.totalPaid) || 0;

  // Resolve therapist snapshot.
  let therapistName = data.therapistName || '';
  if (!therapistName && data.therapistId && data.therapistId !== 'any') {
    const t = await Therapist.findById(data.therapistId).lean();
    therapistName = t ? t.name : '';
  }

  // Server-side slot availability check.
  const freeSlots = await getAvailableSlots(data.date, data.therapistId || 'any');
  if (!freeSlots.includes(data.timeSlot)) {
    throw new HttpError(400, 'Sorry, this time slot is no longer available. Please pick another.');
  }

  // Server-side coupon validation (authoritative).
  let discountAmount = Number(data.discountAmount) || 0;
  let coupon = null;
  if (data.couponCode) {
    coupon = await Coupon.findOne({ code: data.couponCode.toUpperCase().trim() });
    if (!coupon || coupon.active === false || (coupon.expiryDate && new Date(coupon.expiryDate) < new Date())) {
      throw new HttpError(400, 'Invalid or expired coupon code');
    }
    discountAmount = computeCouponDiscount(coupon, servicePrice);
    coupon.usageCount = (coupon.usageCount || 0) + 1;
    await coupon.save();
  }

  const totalPaid = Number(data.totalPaid) || Math.max(0, servicePrice - discountAmount);
  const autoApprove = settings.autoApproveBookings !== false;
  const status = autoApprove ? 'confirmed' : 'pending';

  const booking = await Booking.create({
    ...data,
    bookingNumber: await genBookingNumber(data.date),
    serviceId: service ? service._id : data.serviceId,
    serviceTitle,
    servicePrice,
    therapistName,
    durationMinutes: data.durationMinutes || (service && service.durationMinutes) || 60,
    discountAmount,
    totalPaid,
    status,
    paymentStatus: data.paymentStatus || 'pending',
    paymentMethod: data.paymentMethod || 'pay_at_venue',
  });

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
  const bookings = await Booking.find().sort({ createdAt: -1 }).lean();
  return res.json(bookings.map(serializeBooking));
}

export async function lookupBooking(req, res) {
  const q = String(req.query.q || '').trim();
  if (!q) throw new HttpError(400, 'Provide a booking reference, email or phone number');

  const booking = await Booking.findOne({
    $or: [
      { bookingNumber: q },
      { email: q.toLowerCase() },
      { phone: q },
    ],
  }).lean();

  if (!booking) throw new HttpError(404, 'No booking found');
  return res.json(serializeBooking(booking));
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

  Object.assign(booking, data);
  await booking.save();

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

  const settings = await getSettings();
  const result = await sendBookingReminder(settings, booking.toObject());
  if (!result.success) throw new HttpError(500, 'Reminder could not be sent');

  booking.reminderSentAt = new Date();
  await booking.save();

  await logAudit({ action: 'reminder', module: 'bookings', details: `Sent reminder for ${booking.bookingNumber}`, req });
  return res.json({ success: true, message: 'Reminder sent successfully' });
}

export async function triggerReminders(req, res) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const bookings = await Booking.find({
    date: tomorrow,
    status: { $in: ['confirmed', 'pending'] },
    reminderSentAt: null,
    email: { $ne: '' },
  }).lean();

  const settings = await getSettings();
  let sentCount = 0;
  for (const b of bookings) {
    try {
      const result = await sendBookingReminder(settings, b);
      if (result.success) {
        await Booking.updateOne({ _id: b._id }, { $set: { reminderSentAt: new Date() } });
        sentCount += 1;
      }
    } catch {
      /* continue */
    }
  }

  await logAudit({ action: 'reminders', module: 'bookings', details: `Auto-sent ${sentCount} reminders for ${tomorrow}`, req });
  return res.json({
    success: true,
    message: `${sentCount} reminder${sentCount === 1 ? '' : 's'} sent`,
    data: { sentCount },
  });
}

export default { createBooking, listBookings, lookupBooking, updateBooking, deleteBooking, sendReminder, triggerReminders };