import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { MAIL_CONFIG } from '../config/mail.js';
import { run } from '../config/db.js';

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: MAIL_CONFIG.host,
      port: MAIL_CONFIG.port,
      secure: MAIL_CONFIG.secure,
      auth: MAIL_CONFIG.auth.user ? MAIL_CONFIG.auth : undefined,
      tls: { rejectUnauthorized: false }
    });
  }
  return transporter;
}

export async function sendMail({ to, subject, html, text }) {
  const logId = `eml-${uuidv4().slice(0, 8)}`;
  try {
    if (!MAIL_CONFIG.auth.user) {
      console.log(`[Email Service - Simulated Send] To: ${to} | Subject: ${subject}`);
      run('INSERT INTO email_logs (id, recipient, subject, status, details) VALUES (?, ?, ?, ?, ?)', [
        logId, to, subject, 'sent', 'Simulated dispatch (No SMTP credentials configured)'
      ]);
      return { success: true, simulated: true };
    }

    const mailer = getTransporter();
    const info = await mailer.sendMail({
      from: MAIL_CONFIG.from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '')
    });

    run('INSERT INTO email_logs (id, recipient, subject, status, details) VALUES (?, ?, ?, ?, ?)', [
      logId, to, subject, 'sent', `Message ID: ${info.messageId}`
    ]);

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Email sending error:', err.message);
    run('INSERT INTO email_logs (id, recipient, subject, status, details) VALUES (?, ?, ?, ?, ?)', [
      logId, to, subject, 'failed', err.message
    ]);
    return { success: false, error: err.message };
  }
}
