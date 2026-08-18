import Setting from '../models/Setting.js';
import { serializeSettings } from '../utils/serializers.js';
import { getSingletonSetting } from '../services/settingService.js';
import { logAudit } from '../services/auditService.js';
import env from '../config/env.js';

const FLAT_KEYS = [
  'businessName', 'siteName', 'tagline', 'phone', 'whatsapp', 'email', 'address',
  'city', 'workingHours', 'openingHours', 'currencySymbol', 'currencyCode',
  'googleMapsUrl', 'facebookUrl', 'instagramUrl', 'twitterUrl',
  'smtpHost', 'smtpPort', 'smtpUser', 'smtpSenderName', 'smtpSenderEmail',
  'bookingEmailTemplate', 'contactEmailTemplate',
  'bookingDurationMinutes', 'maxDailyBookings', 'maxBookingsPerSlot',
  'slotIntervalMinutes', 'autoApproveBookings', 'advanceBookingDays',
  'cancellationNoticeHours', 'sessionTimeoutMinutes', 'maxLoginAttempts',
  'enable2FA', 'primaryColor', 'logoUrl', 'faviconUrl', 'heroBannerUrl',
  'heroTitle', 'heroSubtitle',
];

const SEO_KEYS = ['metaTitle', 'metaDescription', 'keywords', 'ogImage', 'twitterCard', 'enableJsonLd', 'robotsTxt'];
const PG_KEYS = ['payAtVenue', 'upiQrCode', 'razorpayEnabled', 'stripeEnabled'];

export async function getSettings(req, res) {
  const doc = await getSingletonSetting();
  const obj = doc.toObject();
  obj.smtpConfigured = Boolean(env.smtp.host) || Boolean(obj.smtpHost);
  return res.json(serializeSettings(obj));
}

export async function updateSettings(req, res) {
  const doc = await getSingletonSetting();
  const body = req.body || {};

  for (const key of FLAT_KEYS) {
    if (body[key] !== undefined) {
      doc[key] = body[key];
    }
  }

  if (body.seo && typeof body.seo === 'object') {
    for (const key of SEO_KEYS) {
      if (body.seo[key] !== undefined) doc.seo[key] = body.seo[key];
    }
  } else {
    for (const key of SEO_KEYS) {
      if (body[key] !== undefined) doc.seo[key] = body[key];
    }
  }

  if (body.paymentGateways && typeof body.paymentGateways === 'object') {
    for (const key of PG_KEYS) {
      if (body.paymentGateways[key] !== undefined) doc.paymentGateways[key] = body.paymentGateways[key];
    }
  }

  if (body.smtpHost !== undefined) {
    doc.smtpConfigured = Boolean(body.smtpHost) || Boolean(env.smtp.host);
  }

  await doc.save();

  const obj = doc.toObject();
  obj.smtpConfigured = Boolean(env.smtp.host) || Boolean(obj.smtpHost);
  await logAudit({ action: 'update', module: 'settings', details: 'Updated business settings', req });
  return res.json(serializeSettings(obj));
}

export default { getSettings, updateSettings };