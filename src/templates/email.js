/**
 * Simple HTML email templates. Each render function takes a context object
 * and returns a full HTML document. Branding colors match the frontend
 * (primary #2CB5A0) and settings drive business info + optional custom bodies.
 */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function shell({ settings, title, body }) {
  const name = esc(settings.businessName || 'Tripod Wellness');
  const safeTitle = esc(title);
  const tagline = esc(settings.tagline || 'Premier Indian Massage Therapy & Holistic Wellness Sanctuary');
  const address = esc(settings.address || '');
  const phone = esc(settings.phone || '');
  const email = esc(settings.email || '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td style="background:#2CB5A0;padding:20px 28px;color:#ffffff;">
            <h1 style="margin:0;font-size:20px;">${name}</h1>
            <p style="margin:4px 0 0;font-size:13px;opacity:.9;">${tagline}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;color:#1f2937;font-size:14px;line-height:1.6;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;">
            <p style="margin:0 0 6px;">${address}</p>
            <p style="margin:0;">Phone: ${phone} &nbsp;·&nbsp; Email: ${email}</p>
            <p style="margin:8px 0 0;">This is an automated message — please do not reply directly.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function bookingConfirmation(settings, booking) {
  const statusLabel = booking.status === 'pending' ? 'PENDING CONFIRMATION' : 'CONFIRMED';
  const body = `
    <h2 style="margin:0 0 12px;color:#111827;">Appointment ${statusLabel}</h2>
    <p>Dear <strong>${esc(booking.customerName)}</strong>, thank you for choosing ${esc(settings.businessName || 'Tripod Wellness')}.</p>
    <table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="background:#f9fafb;border-radius:8px;margin:16px 0;">
      <tr><td style="color:#6b7280;width:45%;">Booking ref.</td><td style="font-weight:600;">${esc(booking.bookingNumber)}</td></tr>
      <tr><td style="color:#6b7280;">Service</td><td>${esc(booking.serviceTitle || '—')}</td></tr>
      <tr><td style="color:#6b7280;">Therapist</td><td>${esc(booking.therapistName || 'Auto-assigned')}</td></tr>
      <tr><td style="color:#6b7280;">Date</td><td>${esc(fmtDate(booking.date))}</td></tr>
      <tr><td style="color:#6b7280;">Time</td><td>${esc(booking.timeSlot || '')}</td></tr>
      <tr><td style="color:#6b7280;">Duration</td><td>${booking.durationMinutes ? `${Number(booking.durationMinutes)} min` : '—'}</td></tr>
      <tr><td style="color:#6b7280;">Total</td><td style="font-weight:600;">${esc(settings.currencySymbol || '₹')}${Number(booking.totalPaid || 0).toFixed(0)}</td></tr>
    </table>
    <p>If your appointment is pending, our concierge team will reach out shortly to confirm your slot.</p>
    <p>Need to manage or cancel this visit? Reply to this email or call us at ${esc(settings.phone || '')}.</p>
  `;
  return shell({ settings, title: `Appointment ${statusLabel} — ${booking.bookingNumber}`, body });
}

export function bookingStatusUpdate(settings, booking) {
  const status = String(booking.status || 'updated').toUpperCase().slice(0, 20);
  const body = `
    <h2 style="margin:0 0 12px;color:#111827;">Booking ${esc(status)}</h2>
    <p>Dear <strong>${esc(booking.customerName)}</strong>, your appointment <strong>${esc(booking.bookingNumber)}</strong> has been updated to:</p>
    <p style="font-size:16px;font-weight:600;color:#2CB5A0;">${esc(status)}</p>
    <table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="background:#f9fafb;border-radius:8px;margin:16px 0;">
      <tr><td style="color:#6b7280;width:45%;">Service</td><td>${esc(booking.serviceTitle || '—')}</td></tr>
      <tr><td style="color:#6b7280;">Date</td><td>${esc(fmtDate(booking.date))}</td></tr>
      <tr><td style="color:#6b7280;">Time</td><td>${esc(booking.timeSlot || '')}</td></tr>
    </table>
    ${booking.cancelledReason ? `<p>Reason: ${esc(booking.cancelledReason)}</p>` : ''}
    <p>Questions? Call us at ${esc(settings.phone || '')}.</p>
  `;
  return shell({ settings, title: `Booking ${status} — ${booking.bookingNumber}`, body });
}

export function bookingReminder(settings, booking) {
  const body = `
    <h2 style="margin:0 0 12px;color:#111827;">Gentle reminder</h2>
    <p>Dear <strong>${esc(booking.customerName)}</strong>, this is a friendly reminder about your upcoming appointment.</p>
    <table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="background:#f9fafb;border-radius:8px;margin:16px 0;">
      <tr><td style="color:#6b7280;width:45%;">Booking ref.</td><td style="font-weight:600;">${esc(booking.bookingNumber)}</td></tr>
      <tr><td style="color:#6b7280;">Service</td><td>${esc(booking.serviceTitle || '—')}</td></tr>
      <tr><td style="color:#6b7280;">Date</td><td>${esc(fmtDate(booking.date))}</td></tr>
      <tr><td style="color:#6b7280;">Time</td><td>${esc(booking.timeSlot || '')}</td></tr>
    </table>
    <p>We look forward to seeing you. Need to reschedule? Call us at ${esc(settings.phone || '')}.</p>
  `;
  return shell({ settings, title: `Reminder — ${booking.bookingNumber}`, body });
}

export function contactThankYou(settings, message) {
  const body = `
    <h2 style="margin:0 0 12px;color:#111827;">Thank you for reaching out</h2>
    <p>Dear <strong>${esc(message.name)}</strong>,</p>
    <p>We've received your message and our concierge team will get back to you within one business day.</p>
    <p style="color:#6b7280;font-style:italic;border-left:3px solid #2CB5A0;padding-left:12px;">“${esc(message.message)}”</p>
    <p>Meanwhile, feel free to call us directly at ${esc(settings.phone || '')}.</p>
  `;
  return shell({ settings, title: `We received your message, ${message.name}`, body });
}

export function newsletterWelcome(settings, subscriber) {
  const body = `
    <h2 style="margin:0 0 12px;color:#111827;">Welcome aboard!</h2>
    <p>Dear <strong>${esc(subscriber.email)}</strong>,</p>
    <p>Thanks for subscribing to ${esc(settings.businessName || 'Tripod Wellness')} updates. Expect offers, new-treatment announcements and wellness tips.</p>
  `;
  return shell({ settings, title: 'Welcome to our newsletter', body });
}

export function passwordReset(settings, resetUrl, expiryLabel = '1 hour') {
  const safeUrl = String(resetUrl || '#');
  const body = `
    <h2 style="margin:0 0 12px;color:#111827;">Reset your password</h2>
    <p>You requested a password reset for your ${esc(settings.businessName || 'Tripod Wellness')} staff account.</p>
    <p style="margin:24px 0;">
      <a href="${esc(safeUrl)}" style="background:#2CB5A0;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Reset password</a>
    </p>
    <p style="color:#6b7280;font-size:13px;">This link expires in ${esc(expiryLabel)}. If you didn't request this, you can safely ignore this email.</p>
  `;
  return shell({ settings, title: 'Reset your password', body });
}

export function staffApplicationApproved(settings, { name, role, loginUrl }) {
  const safeUrl = String(loginUrl || '').startsWith('/') || String(loginUrl || '').startsWith('http') ? String(loginUrl) : '/admin-login';
  const body = `
    <h2 style="margin:0 0 12px;color:#111827;">Your staff account was approved</h2>
    <p>Dear <strong>${esc(name)}</strong>,</p>
    <p>Your application for <strong>${esc(role)}</strong> access to the ${esc(settings.businessName || 'Tripod Wellness')} admin portal has been approved by the director.</p>
    <p>You can now sign in with the email and password you submitted during registration:</p>
    <p style="margin:24px 0;">
      <a href="${esc(safeUrl)}" style="background:#2CB5A0;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Sign in to the portal</a>
    </p>
    <p>Forgot your password? Use the "Forgot?" link on the sign-in page to reset it.</p>
    <p style="color:#6b7280;font-size:13px;">Questions? Contact the director at ${esc(settings.phone || '')}.</p>
  `;
  return shell({ settings, title: 'Your staff account was approved', body });
}

export function staffApplicationRejected(settings, { name, reason }) {
  const body = `
    <h2 style="margin:0 0 12px;color:#111827;">Update on your staff account application</h2>
    <p>Dear <strong>${esc(name)}</strong>,</p>
    <p>Thank you for your interest in joining the ${esc(settings.businessName || 'Tripod Wellness')} team.</p>
    <p>After review, your application for staff portal access could not be approved at this time.</p>
    ${reason ? `<p style="color:#6b7280;font-style:italic;border-left:3px solid #2CB5A0;padding-left:12px;">${esc(reason)}</p>` : ''}
    <p>If you believe this decision was made in error, please reply to this email or contact the director at ${esc(settings.phone || '')}.</p>
  `;
  return shell({ settings, title: 'Update on your staff account application', body });
}

export default { bookingConfirmation, bookingStatusUpdate, bookingReminder, contactThankYou, newsletterWelcome, passwordReset, staffApplicationApproved, staffApplicationRejected };