import NewsletterSubscriber from '../models/NewsletterSubscriber.js';
import { serializeNewsletterSubscriber } from '../utils/serializers.js';
import { HttpError } from '../utils/api.js';
import { createNotification } from '../services/notificationService.js';
import { sendNewsletterWelcome, getSettings } from '../services/emailService.js';
import { logAudit } from '../services/auditService.js';

export async function subscribe(req, res) {
  const email = String((req.body && req.body.email) || '').toLowerCase().trim();
  if (!email) throw new HttpError(400, 'Email is required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Please provide a valid email address');
  }

  try {
    const sub = await NewsletterSubscriber.findOneAndUpdate(
      { email },
      { $setOnInsert: { email }, $set: { active: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (sub && sub.createdAt && Date.now() - new Date(sub.createdAt).getTime() < 5000) {
      createNotification({ type: 'newsletter', title: 'New newsletter subscriber', message: email, link: '' });
      getSettings().then((s) => { sendNewsletterWelcome(s, { email }).catch(() => {}); });
    }
  } catch (err) {
    if (err.code === 11000) {
      await NewsletterSubscriber.updateOne({ email }, { $set: { active: true } });
    } else throw err;
  }

  return res.status(201).json({ success: true, message: 'Subscribed successfully' });
}

export async function unsubscribe(req, res) {
  const email = String((req.body && req.body.email) || '').toLowerCase().trim();
  if (!email) throw new HttpError(400, 'Email is required');
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