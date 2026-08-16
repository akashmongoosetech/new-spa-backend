import { v4 as uuidv4 } from 'uuid';
import { BookingModel } from '../models/BookingModel.js';
import { CouponModel } from '../models/CouponModel.js';
import { SettingsModel } from '../models/SettingsModel.js';
import { generateBookingNumber } from '../utils/helpers.js';
import { sendError, sendSuccess, handleError } from '../utils/responseHandler.js';
import { createNotification } from '../services/notificationService.js';
import { sendMail } from '../services/emailService.js';

// Returns true when the given date is blocked by schedule config.
function isDateBlocked(date) {
  try {
    const settings = SettingsModel.getSettings();
    const schedule = settings.scheduleConfig;
    if (!schedule) return false;
    if (schedule.emergencyClosure) return true;
    const blocked = (schedule.blockedDates || []).includes(date);
    const holiday = (schedule.holidays || []).some((h) => h && h.date === date);
    return blocked || holiday;
  } catch (err) {
    return false;
  }
}

export const getBookings = (req, res) => {
  try {
    let bookings = BookingModel.getAll();
    const q = (req.query.q || '').trim().toLowerCase();
    if (q) {
      bookings = bookings.filter((b) =>
        (b.bookingNumber && b.bookingNumber.toLowerCase().includes(q)) ||
        (b.email && b.email.toLowerCase().includes(q)) ||
        (b.customerName && b.customerName.toLowerCase().includes(q)) ||
        (b.id && b.id.toLowerCase() === q)
      );
    }
    return res.json(bookings);
  } catch (err) {
    return handleError(res, err);
  }
};

export const getBookingById = (req, res) => {
  try {
    const booking = BookingModel.getById(req.params.id);
    if (!booking) return sendError(res, 'Booking not found', 404);
    return res.json(booking);
  } catch (err) {
    return handleError(res, err);
  }
};

export const createBooking = async (req, res) => {
  try {
    const {
      serviceId, serviceTitle, therapistId, therapistName,
      date, timeSlot, customerName, email, phone, notes,
      totalPaid, couponCode, discountAmount, paymentMethod
    } = req.body;

    if (!serviceId || !date || !timeSlot || !customerName || !email || !phone) {
      return sendError(res, 'Missing required booking fields', 400);
    }

    if (isDateBlocked(date)) {
      return sendError(res, 'The spa is closed on the selected date. Please choose another day.', 400);
    }

    const id = `bk-${uuidv4().slice(0, 8)}`;
    const bookingNumber = generateBookingNumber();

    if (couponCode) {
      CouponModel.incrementUsage(couponCode);
    }

    const newBooking = BookingModel.create({
      id,
      bookingNumber,
      serviceId,
      serviceTitle: serviceTitle || 'Therapy Treatment',
      therapistId: therapistId || 'any',
      therapistName: therapistName || 'Any Available Therapist',
      date,
      timeSlot,
      customerName,
      email,
      phone,
      notes,
      totalPaid: totalPaid || 0,
      couponCode,
      discountAmount: discountAmount || 0,
      paymentMethod: paymentMethod || 'pay_at_venue',
      status: 'confirmed'
    });

    createNotification(
      'New Appointment Booking',
      `Booking ${bookingNumber} for ${customerName} (${serviceTitle}) on ${date} at ${timeSlot}`,
      'booking',
      '/admin/bookings'
    );

    sendMail({
      to: email,
      subject: `Booking Confirmed - ${bookingNumber} | Aura Luxe Spa`,
      html: `
        <h2>Appointment Confirmation - Aura Luxe Spa</h2>
        <p>Dear ${customerName},</p>
        <p>Your therapy appointment has been confirmed!</p>
        <ul>
          <li><strong>Booking ID:</strong> ${bookingNumber}</li>
          <li><strong>Therapy:</strong> ${serviceTitle}</li>
          <li><strong>Therapist:</strong> ${therapistName}</li>
          <li><strong>Date:</strong> ${date}</li>
          <li><strong>Time Slot:</strong> ${timeSlot}</li>
          <li><strong>Amount Paid/Due:</strong> ₹${totalPaid}</li>
        </ul>
        <p>We look forward to hosting you at Bandra West, Mumbai.</p>
      `
    });

    return res.status(201).json(newBooking);
  } catch (err) {
    return handleError(res, err);
  }
};

// Public endpoint used by the "manage my reservation" flow. Returns the booking
// when the caller knows its booking number or the registered email.
export const lookupBooking = (req, res) => {
  try {
    const booking = BookingModel.findByQuery(req.query.q);
    if (!booking) return sendError(res, 'Booking not found', 404);
    return res.json(booking);
  } catch (err) {
    return handleError(res, err);
  }
};

export const updateBookingStatus = (req, res) => {
  try {
    const { id } = req.params;
    const existing = BookingModel.getById(id);
    if (!existing) return sendError(res, 'Booking not found', 404);

    // Staff (authenticated) may update freely; public callers must prove they
    // know the booking number (acts as a bearer secret for self-service).
    const isAuthed = Boolean(req.user);
    const secretOk = req.body && req.body.bookingNumber && req.body.bookingNumber === existing.bookingNumber;
    if (!isAuthed && !secretOk) {
      return sendError(res, 'Unauthorized', 401);
    }

    const { status, paymentStatus, notes, therapistId, therapistName, date, timeSlot } = req.body;
    const updated = BookingModel.update(id, {
      status, paymentStatus, notes, therapistId, therapistName, date, timeSlot
    });
    return res.json(updated);
  } catch (err) {
    return handleError(res, err);
  }
};

export const deleteBooking = (req, res) => {
  try {
    BookingModel.delete(req.params.id);
    return sendSuccess(res, null, 'Booking deleted successfully');
  } catch (err) {
    return handleError(res, err);
  }
};

export const sendReminderEmail = async (req, res) => {
  try {
    const booking = BookingModel.getById(req.params.id);
    if (!booking) return sendError(res, 'Booking not found', 404);

    await sendMail({
      to: booking.email,
      subject: `Upcoming Appointment Reminder - ${booking.bookingNumber} | Aura Luxe Spa`,
      html: `<p>Dear ${booking.customerName},</p><p>This is a gentle reminder for your upcoming session for <strong>${booking.serviceTitle}</strong> on <strong>${booking.date} at ${booking.timeSlot}</strong>.</p>`
    });

    return sendSuccess(res, null, 'Reminder email dispatched successfully');
  } catch (err) {
    return handleError(res, err);
  }
};

export const triggerAutomatedReminders = async (req, res) => {
  try {
    const bookings = BookingModel.getAll();
    const active = bookings.filter(b => b.status === 'confirmed' || b.status === 'pending');
    let sentCount = 0;

    for (const b of active) {
      await sendMail({
        to: b.email,
        subject: `Appointment Reminder - ${b.bookingNumber}`,
        html: `<p>Reminder for your session on ${b.date} at ${b.timeSlot}.</p>`
      });
      sentCount++;
    }

    return sendSuccess(res, { sentCount }, `Dispatched ${sentCount} automated reminders`);
  } catch (err) {
    return handleError(res, err);
  }
};
