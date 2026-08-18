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

  let sub = await NewsletterSubscriber.findOne({ email });
  if (!sub) {
    sub = await NewsletterSubscriber.create({ email });
    createNotification({
      type: 'newsletter',
      title: 'New newsletter subscriber',
      message: email,
      link: '',
    });
    getSettings().then((s) => {
      sendNewsletterWelcome(s, { email }).catch(() => {});
    });
  } else if (sub.active === false) {
    sub.active = true;
    await sub.save();
  }

  return res.status(201).json({ success: true, message: 'Subscribed successfully' });
}

export async function listSubscribers(req, res) {
  const subs = await NewsletterSubscriber.find().sort({ createdAt: -1 }).lean();
  return res.json(subs.map(serializeNewsletterSubscriber));
}

export async function deleteSubscriber(req, res) {
  const sub = await NewsletterSubscriber.findById(req.params.id);
  if (!sub) throw new HttpError(404, 'Subscriber not found');

  await sub.deleteOne();
  await logAudit({ action: 'delete', module: 'newsletter', details: `Removed subscriber ${sub.email}`, req });
  return res.json({ success: true });
}

export default { subscribe, listSubscribers, deleteSubscriber };