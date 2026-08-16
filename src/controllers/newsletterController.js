import { v4 as uuidv4 } from 'uuid';
import { NewsletterModel } from '../models/NewsletterModel.js';
import { sendError, sendSuccess, handleError } from '../utils/responseHandler.js';
import { createNotification } from '../services/notificationService.js';
import { sendMail } from '../services/emailService.js';

export const getSubscribers = (req, res) => {
  try {
    const list = NewsletterModel.getAll();
    return res.json(list);
  } catch (err) {
    return handleError(res, err);
  }
};

export const subscribeNewsletter = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return sendError(res, 'Email address is required', 400);

    const existing = NewsletterModel.findByEmail(email);
    if (existing) {
      return res.json({ message: 'You are already subscribed to our newsletter VIP list.' });
    }

    const id = `news-${uuidv4().slice(0, 8)}`;
    const sub = NewsletterModel.subscribe(id, email);

    createNotification('New VIP Subscriber', `Subscribed: ${email}`, 'newsletter');

    sendMail({
      to: email,
      subject: 'Welcome to Aura Luxe Spa VIP Newsletter',
      html: `<p>Welcome to Aura Luxe Spa!</p><p>You are now subscribed to receive exclusive offers, wellness tips, and spa invitations.</p>`
    });

    return res.status(201).json({ message: 'Subscribed successfully', subscriber: sub });
  } catch (err) {
    return handleError(res, err);
  }
};

export const deleteSubscriber = (req, res) => {
  try {
    NewsletterModel.delete(req.params.id);
    return sendSuccess(res, null, 'Subscriber removed');
  } catch (err) {
    return handleError(res, err);
  }
};
