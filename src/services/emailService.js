import nodemailer from 'nodemailer';
import env from '../config/env.js';
import EmailLog from '../models/EmailLog.js';
import Setting from '../models/Setting.js';
import templates from '../templates/email.js';
import logger from '../utils/logger.js';

let transport = null;

function getTransport() {
  if (!env.smtp.host) return null;
  if (transport) return transport;
  transport = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: env.smtp.user
      ? { user: env.smtp.user, pass: env.smtp.pass }
      : undefined,
  });
  return transport;
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
 * Send an email. Always records an EmailLog row.
 * When no SMTP is configured (dev fallback) the email is logged to the console
 * but marked as "sent" so the admin email-logs view still shows activity.
 *
 * @returns {Promise<{success: boolean, logId?: string, simulated?: boolean}>}
 */
export async function sendEmail({ to, subject, html, type = 'booking_confirmation', skipLog = false }) {
  if (!to) {
    logger.warn('email', 'Skipping email with no recipient');
    return { success: false };
  }

  const fromName = env.smtp.fromName || 'Tripod Wellness';
  const fromAddress = env.smtp.from || env.adminEmail || 'noreply@tripodwellness.local';
  const mailOptions = {
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    html,
  };

  let status = 'sent';
  let error = '';

  const sender = getTransport();
  if (sender) {
    try {
      await sender.sendMail(mailOptions);
    } catch (err) {
      status = 'failed';
      error = err.message || 'SMTP send failed';
      logger.error('email', `Send failed to ${to}`, err);
    }
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
  const custom = settings.bookingEmailTemplate;
  const html = custom || templates.bookingConfirmation(settings, booking);
  return sendEmail({
    to: booking.email,
    subject: `Appointment ${booking.status === 'pending' ? 'received' : 'confirmed'} — ${booking.bookingNumber}`,
    html,
    type: 'booking_confirmation',
  });
}

export async function sendBookingStatusUpdate(settings, booking) {
  const html = templates.bookingStatusUpdate(settings, booking);
  return sendEmail({
    to: booking.email,
    subject: `Booking ${booking.status.toUpperCase()} — ${booking.bookingNumber}`,
    html,
    type: 'booking_status_update',
  });
}

export async function sendBookingReminder(settings, booking) {
  const html = templates.bookingReminder(settings, booking);
  return sendEmail({
    to: booking.email,
    subject: `Reminder: ${booking.bookingNumber}`,
    html,
    type: 'booking_reminder',
  });
}

export async function sendContactThankYou(settings, message) {
  const custom = settings.contactEmailTemplate;
  const html = custom || templates.contactThankYou(settings, message);
  return sendEmail({
    to: message.email,
    subject: 'We received your message',
    html,
    type: 'contact_thankyou',
  });
}

export async function sendNewsletterWelcome(settings, subscriber) {
  const html = templates.newsletterWelcome(settings, subscriber);
  return sendEmail({
    to: subscriber.email,
    subject: 'Welcome to our newsletter',
    html,
    type: 'newsletter_welcome',
  });
}

export async function sendPasswordReset(to, resetUrl) {
  const settings = await getSettings();
  const html = templates.passwordReset(settings, resetUrl);
  return sendEmail({
    to,
    subject: 'Reset your password',
    html,
    type: 'booking_status_update',
    skipLog: true, // reset emails are security-sensitive; keep them out of the log list
  });
}

export async function sendStaffApplicationApproved(to, name, role) {
  const settings = await getSettings();
  const loginUrl = `${env.clientUrl}/admin-login`;
  const html = templates.staffApplicationApproved(settings, { name, role, loginUrl });
  return sendEmail({
    to,
    subject: 'Your staff account was approved',
    html,
    type: 'staff_application',
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
  });
}

export default { sendEmail, sendBookingConfirmation, sendBookingStatusUpdate, sendBookingReminder, sendContactThankYou, sendNewsletterWelcome, sendPasswordReset, sendStaffApplicationApproved, sendStaffApplicationRejected, getSettings };