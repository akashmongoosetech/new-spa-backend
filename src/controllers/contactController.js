import ContactMessage from '../models/ContactMessage.js';
import { serializeContactMessage } from '../utils/serializers.js';
import { HttpError } from '../utils/api.js';
import { createNotification } from '../services/notificationService.js';
import { sendContactThankYou, getSettings } from '../services/emailService.js';
import { logAudit } from '../services/auditService.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES = ['new', 'read', 'replied', 'archived'];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function createContact(req, res) {
  const { name, email, phone, subject, message } = req.body || {};
  if (!name || !String(name).trim() || !email || !message || !String(message).trim()) {
    throw new HttpError(400, 'Name, email and message are required');
  }
  if (!EMAIL_RE.test(String(email).trim())) throw new HttpError(400, 'Valid email is required');
  if (String(name).length > 120) throw new HttpError(400, 'Name is too long');
  if (String(message).length > 5000) throw new HttpError(400, 'Message is too long');
  if (subject && String(subject).length > 200) throw new HttpError(400, 'Subject is too long');

  const contact = await ContactMessage.create({
    name: String(name).trim().slice(0, 120),
    email: String(email).toLowerCase().trim(),
    phone: String(phone || '').slice(0, 40),
    subject: String(subject || '').slice(0, 200),
    message: String(message).slice(0, 5000),
  });

  createNotification({
    type: 'contact',
    title: 'New contact message',
    message: `${contact.name} (${contact.email}) sent a message`,
    link: 'contacts',
  });
  getSettings().then((s) => {
    sendContactThankYou(s, contact.toObject()).catch(() => {});
  });

  return res.status(201).json({ success: true });
}

export async function listContacts(req, res) {
  const contacts = await ContactMessage.find().sort({ createdAt: -1 }).limit(500).lean();
  return res.json(contacts.map(serializeContactMessage));
}

export async function updateContact(req, res) {
  const contact = await ContactMessage.findById(req.params.id);
  if (!contact) throw new HttpError(404, 'Message not found');

  const b = req.body || {};
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) throw new HttpError(400, 'Invalid status');
    contact.status = b.status;
    if (b.status === 'replied' && !contact.repliedAt) contact.repliedAt = new Date();
  }
  if (b.replyText !== undefined) contact.replyText = String(b.replyText).slice(0, 5000);
  if (b.reply_text !== undefined) contact.replyText = String(b.reply_text).slice(0, 5000);

  await contact.save();
  return res.json(serializeContactMessage(contact.toObject()));
}

export async function replyContact(req, res) {
  const contact = await ContactMessage.findById(req.params.id);
  if (!contact) throw new HttpError(404, 'Message not found');

  const { replyText } = req.body || {};
  if (!replyText || !String(replyText).trim()) throw new HttpError(400, 'Reply text is required');
  if (String(replyText).length > 5000) throw new HttpError(400, 'Reply is too long');

  contact.replyText = String(replyText).slice(0, 5000);
  contact.status = 'replied';
  contact.repliedAt = new Date();
  await contact.save();

  const settings = await getSettings();
  const { sendEmail } = await import('../services/emailService.js');
  await sendEmail({
    to: contact.email,
    subject: `Re: ${String(contact.subject || 'Your message to ' + (settings.businessName || 'Tripod Wellness')).slice(0, 150)}`,
    html: `<p>Dear <strong>${esc(contact.name)}</strong>,</p><p>${esc(replyText).replace(/\n/g, '<br/>')}</p>`,
    type: 'contact_thankyou',
  });

  await logAudit({ action: 'reply', module: 'contacts', details: `Replied to ${contact.email}`, req });
  return res.json(serializeContactMessage(contact.toObject()));
}

export async function deleteContact(req, res) {
  const contact = await ContactMessage.findById(req.params.id);
  if (!contact) throw new HttpError(404, 'Message not found');

  await contact.deleteOne();
  await logAudit({ action: 'delete', module: 'contacts', details: `Deleted message from ${contact.email}`, req });
  return res.json({ success: true });
}

export async function bulkDeleteContacts(req, res) {
  const ids = (req.body && req.body.ids) || [];
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new HttpError(400, 'No messages selected');
  }
  if (ids.length > 100) throw new HttpError(400, 'Select at most 100 messages at a time');
  if (!ids.every((v) => typeof v === 'string' && /^[a-fA-F0-9]{24}$/.test(v))) {
    throw new HttpError(400, 'Invalid message ids');
  }
  const res2 = await ContactMessage.deleteMany({ _id: { $in: ids } });
  await logAudit({ action: 'bulk_delete', module: 'contacts', details: `Deleted ${res2.deletedCount} messages`, req });
  return res.json({ success: true, count: res2.deletedCount });
}

export default { createContact, listContacts, updateContact, replyContact, deleteContact, bulkDeleteContacts };