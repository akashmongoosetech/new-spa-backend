import Booking from '../models/Booking.js';
import ContactMessage from '../models/ContactMessage.js';
import Therapist from '../models/Therapist.js';
import Service from '../models/Service.js';
import NewsletterSubscriber from '../models/NewsletterSubscriber.js';

function escapeCsv(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(values) {
  return values.map(escapeCsv).join(',');
}

function dateStr(d) {
  return d ? new Date(d).toISOString() : '';
}

const BOOKING_HEADERS = [
  'BookingNumber', 'CustomerName', 'Email', 'Phone', 'Service', 'Therapist',
  'Date', 'TimeSlot', 'DurationMinutes', 'DiscountAmount', 'TotalPaid',
  'CouponCode', 'PaymentMethod', 'PaymentStatus', 'Status', 'CreatedAt',
];

const CONTACT_HEADERS = [
  'Id', 'Name', 'Email', 'Phone', 'Subject', 'Message', 'Status', 'ReplyText', 'RepliedAt', 'CreatedAt',
];

const THERAPIST_HEADERS = [
  'Id', 'Name', 'Title', 'ExperienceYears', 'Specialties', 'Rating', 'ReviewsCount',
  'Featured', 'Active', 'AvailableDays', 'CreatedAt',
];

const SERVICE_HEADERS = [
  'Id', 'Title', 'Slug', 'Category', 'Price', 'OriginalPrice', 'DurationMinutes',
  'Featured', 'Active', 'Rating', 'ReviewsCount', 'ShortDescription', 'CreatedAt',
];

const SUBSCRIBER_HEADERS = ['Email', 'Active', 'SubscribedAt'];

/**
 * Build a CSV export of bookings.
 * @param {string} type 'all' | 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'revenue'
 * @returns {{ filename: string, csv: string }}
 */
export async function exportBookingsCsv(type = 'all') {
  const query = {};
  if (type === 'revenue') {
    query.status = { $nin: ['cancelled', 'rejected'] };
  } else if (type && type !== 'all') {
    query.status = type;
  }

  const bookings = await Booking.find(query).sort({ createdAt: -1 }).lean();

  const lines = [row(BOOKING_HEADERS)];
  for (const b of bookings) {
    lines.push(
      row([
        b.bookingNumber || '',
        b.customerName || '',
        b.email || '',
        b.phone || '',
        b.serviceTitle || '',
        b.therapistName || '',
        b.date || '',
        b.timeSlot || '',
        b.durationMinutes || '',
        b.discountAmount ?? 0,
        b.totalPaid ?? 0,
        b.couponCode || '',
        b.paymentMethod || '',
        b.paymentStatus || '',
        b.status || '',
        dateStr(b.createdAt),
      ])
    );
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  return {
    filename: `bookings_${type}_${dateStr}.csv`,
    csv: lines.join('\r\n'),
  };
}

export async function exportContactsCsv() {
  const items = await ContactMessage.find().sort({ createdAt: -1 }).lean();

  const lines = [row(CONTACT_HEADERS)];
  for (const c of items) {
    lines.push(
      row([
        c._id ? c._id.toString() : '',
        c.name || '',
        c.email || '',
        c.phone || '',
        c.subject || '',
        c.message || '',
        c.status || '',
        c.replyText || '',
        dateStr(c.repliedAt),
        dateStr(c.createdAt),
      ])
    );
  }

  const d = new Date().toISOString().slice(0, 10);
  return { filename: `contact_inquiries_${d}.csv`, csv: lines.join('\r\n') };
}

export async function exportTherapistsCsv() {
  const items = await Therapist.find().sort({ createdAt: -1 }).lean();

  const lines = [row(THERAPIST_HEADERS)];
  for (const t of items) {
    lines.push(
      row([
        t._id ? t._id.toString() : '',
        t.name || '',
        t.title || '',
        t.experienceYears ?? 0,
        Array.isArray(t.specialties) ? t.specialties.join('; ') : '',
        t.rating ?? 0,
        t.reviewsCount ?? 0,
        t.featured ? 'Yes' : 'No',
        t.active ? 'Yes' : 'No',
        Array.isArray(t.availableDays) ? t.availableDays.join('; ') : '',
        dateStr(t.createdAt),
      ])
    );
  }

  const d = new Date().toISOString().slice(0, 10);
  return { filename: `therapists_${d}.csv`, csv: lines.join('\r\n') };
}

export async function exportServicesCsv() {
  const items = await Service.find().sort({ createdAt: -1 }).lean();

  const lines = [row(SERVICE_HEADERS)];
  for (const s of items) {
    lines.push(
      row([
        s._id ? s._id.toString() : '',
        s.title || '',
        s.slug || '',
        s.category || '',
        s.price ?? 0,
        s.originalPrice ?? '',
        s.durationMinutes ?? 0,
        s.featured ? 'Yes' : 'No',
        s.active ? 'Yes' : 'No',
        s.rating ?? 0,
        s.reviewsCount ?? 0,
        s.shortDescription || '',
        dateStr(s.createdAt),
      ])
    );
  }

  const d = new Date().toISOString().slice(0, 10);
  return { filename: `services_${d}.csv`, csv: lines.join('\r\n') };
}

export async function exportSubscribersCsv() {
  const items = await NewsletterSubscriber.find({ active: true }).sort({ createdAt: -1 }).lean();

  const lines = [row(SUBSCRIBER_HEADERS)];
  for (const s of items) {
    lines.push(row([s.email || '', 'Yes', dateStr(s.createdAt)]));
  }

  const d = new Date().toISOString().slice(0, 10);
  return { filename: `subscribers_${d}.csv`, csv: lines.join('\r\n') };
}

/**
 * Dispatch a CSV export by report type.
 * @param {string} type 'bookings' | 'all' | 'revenue' | booking status | 'contacts' | 'therapists' | 'services' | 'subscribers'
 */
export async function exportReportCsv(type) {
  switch (type) {
    case 'contacts':
      return exportContactsCsv();
    case 'therapists':
      return exportTherapistsCsv();
    case 'services':
      return exportServicesCsv();
    case 'subscribers':
      return exportSubscribersCsv();
    case 'bookings':
    case 'all':
    case 'revenue':
    case 'confirmed':
    case 'pending':
    case 'completed':
    case 'cancelled':
    default:
      return exportBookingsCsv(type === 'bookings' ? 'all' : type);
  }
}

export default { exportBookingsCsv, exportContactsCsv, exportTherapistsCsv, exportServicesCsv, exportSubscribersCsv, exportReportCsv };
