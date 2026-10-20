import crypto from 'crypto';
import env from '../config/env.js';

const PURPOSE = 'newsletter-unsubscribe';

export function newsletterUnsubscribeToken(email) {
  const normalized = String(email || '').toLowerCase().trim();
  return crypto
    .createHmac('sha256', env.jwtSecret)
    .update(`${PURPOSE}:${normalized}`)
    .digest('base64url');
}

export function verifyNewsletterUnsubscribeToken(email, token) {
  const expected = newsletterUnsubscribeToken(email);
  const provided = String(token || '');
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function newsletterUnsubscribeUrl(email) {
  const base = String(env.clientUrl || '').split(',')[0].trim().replace(/\/$/, '');
  const params = new URLSearchParams({
    email: String(email || '').toLowerCase().trim(),
    token: newsletterUnsubscribeToken(email),
  });
  return `${base}/unsubscribe?${params.toString()}`;
}

export default {
  newsletterUnsubscribeToken,
  verifyNewsletterUnsubscribeToken,
  newsletterUnsubscribeUrl,
};
