import nodemailer from 'nodemailer';
import env from '../config/env.js';
import EmailLog from '../models/EmailLog.js';
import Setting from '../models/Setting.js';
import templates from '../templates/email.js';
import logger from '../utils/logger.js';

let transport = null;
let transportKey = '';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Load business settings (used for branding + custom template overrides).
 * Never throws — falls back to a minimal object.
 */
export async function getSettings() {
  try {
    const s = await Setting.findOne({ key: 'default' }).lean();
    if (s) return s;
  } catch {
    /* ignore */
  }
  return {};
}

/**
 * Build (and cache) a transport from DB settings first, then env.
 *
 * The SMTP password is intentionally environment-only: it is never stored in
 * MongoDB or returned by the settings API. Set SMTP_PASS in backend/.env.
 * Host/port/user/sender can be managed from the admin Settings screen.
 */
function getTransport(settings = {}) {
  const host = String(settings.smtpHost || env.smtp.host || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '');
  if (!host) return null;

  const port = Number(settings.smtpPort) || env.smtp.port || 587;
  const secure = settings.smtpHost ? port === 465 : Boolean(env.smtp.secure) || port === 465;
  const user = String(settings.smtpUser || env.smtp.user || '').trim();
  const pass = env.smtp.pass || '';
  const key = `${host}|${port}|${secure}|${user}|${Boolean(pass)}`;

  if (transport && transportKey === key) return transport;
  transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
  transportKey = key;
  return transport;
}

function renderValues(template, vars, { html = true } = {}) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) return _match;
    const value = vars[key] == null ? '' : String(vars[key]);
    return html ? esc(value) : value.replace(/[\r\n]+/g, ' ');
  });
}

function renderSubject(template, vars) {
  return renderValues(template, vars, { html: false }).replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
}

function renderCustomEmail(settings, template, vars, subject) {
  const rendered = renderValues(template, vars, { html: true });
  // A full HTML document is sent as-is; a fragment is wrapped in the brand shell.
  if (/<html[\s>]/i.test(rendered)) return rendered;
  const hasMarkup = /<\s*(p|div|table|h[1-6]|br|ul|ol|li|strong|em|a)\b/i.test(rendered);
  const body = hasMarkup ? rendered : rendered.replace(/\r?\n/g, '<br>');
  return templates.customEmail(settings, { title: subject, body });
}

function formatDateLong(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function bookingVars(settings, booking = {}) {
  const currency = settings.currencySymbol || '₹';
  return {
    businessName: settings.businessName || 'Tripod Wellness',
    customerName: booking.customerName || [booking.firstName, booking.lastName].filter(Boolean).join(' ') || '',
    bookingNumber: booking.bookingNumber || '',
    serviceName: booking.serviceTitle || '—',
    therapistName: booking.therapistName || 'Auto-assigned',
    date: booking.date || '',
    dateLong: formatDateLong(booking.date),
    time: booking.timeSlot || '',
    duration: booking.durationMinutes ? `${Number(booking.durationMinutes)} minutes` : '',
    total: `${currency}${Number(booking.totalPaid || 0).toFixed(0)}`,
    status: booking.status || '',
    phone: settings.phone || '',
    email: settings.email || '',
  };
}

function contactVars(settings, message = {}) {
  return {
    businessName: settings.businessName || 'Tripod Wellness',
    name: message.name || '',
    email: message.email || '',
    phone: message.phone || '',
    subject: message.subject || '',
    message: message.message || '',
    phoneBusiness: settings.phone || '',
  };
}

/**
 * Send an email and record an EmailLog row (unless skipLog is set).
 * When no SMTP is configured in development, the email is logged to the console
 * but marked as "sent" so the admin email-logs view still shows activity.
 * In production a missing SMTP server is recorded as a failure.
 *
 * @returns {Promise<{success: boolean, logId?: string, simulated?: boolean}>}
 */
export async function sendEmail({ to, subject, html, type = 'booking_confirmation', skipLog = false, settings = null }) {
  if (!to) {
    logger.warn('email', 'Skipping email with no recipient');
    return { success: false };
  }

  const cfg = settings || (await getSettings());
  const fromName = String(cfg.smtpSenderName || env.smtp.fromName || 'Tripod Wellness').replace(/["\r\n<>]/g, '').slice(0, 80) || 'Tripod Wellness';
  const fromAddress = String(cfg.smtpSenderEmail || env.smtp.from || env.adminEmail || 'noreply@tripodwellness.local').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromAddress)) {
    logger.error('email', 'Invalid sender address configured');
    return { success: false };
  }
  const mailOptions = {
    from: `"${fromName}" <${fromAddress}>`,
    to: String(to).replace(/[\r\n]+/g, ' ').trim().slice(0, 320),
    subject: String(subject || '').replace(/[\r\n]+/g, ' ').slice(0, 200),
    html,
  };

  let status = 'sent';
  let error = '';

  const sender = getTransport(cfg);
  if (sender) {
    try {
      await sender.sendMail(mailOptions);
    } catch (err) {
      status = 'failed';
      error = err.message || 'SMTP send failed';
      logger.error('email', `Send failed to ${to}`, err);
    }
  } else if (env.isProduction) {
    // Never pretend a production email was delivered when SMTP is missing.
    status = 'failed';
    error = 'SMTP is not configured';
    logger.error('email', 'SMTP is not configured; email was not sent');
  } else {
    // Dev fallback — simulate delivery.
    logger.info('email', `[SIMULATED] ${subject} -> ${to}`);
  }

  let logId = null;
  if (!skipLog) {
    try {
      const log = await EmailLog.create({
        to,
        subject,
        type,
        htmlContent: html,
        status,
        error,
      });
      logId = log._id.toString();
    } catch (err) {
      logger.error('email', 'Failed to persist EmailLog', err);
    }
  }

  return { success: status === 'sent', logId, simulated: !sender };
}

// ---------- high-level helpers ----------

export async function sendBookingConfirmation(settings, booking) {
  const vars = bookingVars(settings, booking);
  const defaultSubject = `Appointment ${booking.status === 'pending' ? 'received' : 'confirmed'} — ${booking.bookingNumber}`;
  const subject = renderSubject(settings.bookingEmailSubject || defaultSubject, vars);
  const custom = String(settings.bookingEmailTemplate || '').trim();
  const html = custom
    ? renderCustomEmail(settings, custom, vars, subject)
    : templates.bookingConfirmation(settings, booking);
  return sendEmail({
    to: booking.email,
    subject,
    html,
    type: 'booking_confirmation',
    settings,
  });
}

export async function sendBookingStatusUpdate(settings, booking) {
  const status = String(booking.status || '');
  if (!status) return { success: false };
  const vars = bookingVars(settings, booking);
  const subject = renderSubject(`Booking ${status.toUpperCase()} — ${booking.bookingNumber}`, vars);
  const html = templates.bookingStatusUpdate(settings, booking);
  return sendEmail({
    to: booking.email,
    subject,
    html,
    type: 'booking_status_update',
    settings,
  });
}

export async function sendBookingReminder(settings, booking) {
  const vars = bookingVars(settings, booking);
  const subject = renderSubject(`Reminder: ${booking.bookingNumber}`, vars);
  const html = templates.bookingReminder(settings, booking);
  return sendEmail({
    to: booking.email,
    subject,
    html,
    type: 'booking_reminder',
    settings,
  });
}

export async function sendContactThankYou(settings, message) {
  const vars = contactVars(settings, message);
  const subject = renderSubject(settings.contactEmailSubject || 'We received your message', vars);
  const custom = String(settings.contactEmailTemplate || '').trim();
  const html = custom
    ? renderCustomEmail(settings, custom, vars, subject)
    : templates.contactThankYou(settings, message);
  return sendEmail({
    to: message.email,
    subject,
    html,
    type: 'contact_thankyou',
    settings,
  });
}

export async function sendNewsletterWelcome(settings, subscriber, unsubscribeUrl = '') {
  const html = templates.newsletterWelcome(settings, subscriber, unsubscribeUrl);
  return sendEmail({
    to: subscriber.email,
    subject: 'Welcome to our newsletter',
    html,
    type: 'newsletter_welcome',
    settings,
  });
}

function resetExpiryLabel() {
  const raw = String(env.resetTokenExpiresIn || '1h').trim().toLowerCase();
  const m = raw.match(/^(\d+)\s*([smhd])$/);
  if (!m) return '1 hour';
  const n = Number(m[1]);
  const unit = { s: 'second', m: 'minute', h: 'hour', d: 'day' }[m[2]];
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

export async function sendPasswordReset(to, resetUrl) {
  const settings = await getSettings();
  const safeUrl = String(resetUrl || '').slice(0, 1000);
  const html = templates.passwordReset(settings, safeUrl, resetExpiryLabel());
  return sendEmail({
    to,
    subject: 'Reset your password',
    html,
    type: 'password_reset',
    skipLog: true, // reset emails are security-sensitive; keep them out of the log list
    settings,
  });
}

export async function sendStaffApplicationApproved(to, name, role) {
  const settings = await getSettings();
  const loginUrl = `${String(env.clientUrl || '').split(',')[0].trim().replace(/\/$/, '')}/admin-login`;
  const html = templates.staffApplicationApproved(settings, { name, role, loginUrl });
  return sendEmail({
    to,
    subject: 'Your staff account was approved',
    html,
    type: 'staff_application',
    settings,
  });
}

export async function sendStaffApplicationRejected(to, name, reason) {
  const settings = await getSettings();
  const html = templates.staffApplicationRejected(settings, { name, reason });
  return sendEmail({
    to,
    subject: 'Update on your staff account application',
    html,
    type: 'staff_application',
    settings,
  });
}

export default {
  sendEmail,
  sendBookingConfirmation,
  sendBookingStatusUpdate,
  sendBookingReminder,
  sendContactThankYou,
  sendNewsletterWelcome,
  sendPasswordReset,
  sendStaffApplicationApproved,
  sendStaffApplicationRejected,
  getSettings,
};
