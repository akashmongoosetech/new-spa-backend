import NewsletterSubscriber from '../models/NewsletterSubscriber.js';
import { serializeNewsletterSubscriber } from '../utils/serializers.js';
import { HttpError } from '../utils/api.js';
import { createNotification } from '../services/notificationService.js';
import { sendNewsletterWelcome, getSettings } from '../services/emailService.js';
import { logAudit } from '../services/auditService.js';
import { verifyNewsletterUnsubscribeToken, newsletterUnsubscribeUrl } from '../utils/newsletterToken.js';
import {
  cleanEmail,
  isHoneypotFilled,
  newsletterInputSchema,
  parseOrThrow,
} from '../utils/inputValidation.js';

export async function subscribe(req, res) {
  if (isHoneypotFilled(req.body)) {
    return res.status(201).json({ success: true, message: 'Subscribed successfully' });
  }
  const body = parseOrThrow(newsletterInputSchema, req.body || {});
  const email = cleanEmail(body.email);
  if (!email) throw new HttpError(400, 'Email is required');

  try {
    const sub = await NewsletterSubscriber.findOneAndUpdate(
      { email },
      {
        $setOnInsert: { email },
        $set: { active: true, consentAt: new Date() },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (sub && sub.createdAt && Date.now() - new Date(sub.createdAt).getTime() < 5000) {
      createNotification({ type: 'newsletter', title: 'New newsletter subscriber', message: email, link: '' });
      getSettings().then((s) => {
        sendNewsletterWelcome(s, { email }, newsletterUnsubscribeUrl(email)).catch(() => {});
      });
    }
  } catch (err) {
    if (err.code === 11000) {
      await NewsletterSubscriber.updateOne(
        { email },
        { $set: { active: true, consentAt: new Date() } }
      );
    } else throw err;
  }

  return res.status(201).json({ success: true, message: 'Subscribed successfully' });
}

export async function unsubscribe(req, res) {
  const body = req.body || {};
  const email = String(body.email || (req.query && req.query.email) || '').toLowerCase().trim();
  const token = String(body.token || (req.query && req.query.token) || '');
  if (!email) throw new HttpError(400, 'Email is required');
  // A signed token prevents anyone from unsubscribing arbitrary addresses.
  if (!verifyNewsletterUnsubscribeToken(email, token)) {
    throw new HttpError(403, 'This unsubscribe link is invalid or has expired');
  }
  await NewsletterSubscriber.updateOne({ email }, { $set: { active: false } });
  return res.json({ success: true, message: 'Unsubscribed successfully' });
}

export async function listSubscribers(req, res) {
  const subs = await NewsletterSubscriber.find().sort({ createdAt: -1 }).limit(1000).lean();
  return res.json(subs.map(serializeNewsletterSubscriber));
}

export async function deleteSubscriber(req, res) {
  const sub = await NewsletterSubscriber.findById(req.params.id);
  if (!sub) throw new HttpError(404, 'Subscriber not found');

  await sub.deleteOne();
  await logAudit({ action: 'delete', module: 'newsletter', details: `Removed subscriber ${sub.email}`, req });
  return res.json({ success: true });
}

export default { subscribe, unsubscribe, listSubscribers, deleteSubscriber };