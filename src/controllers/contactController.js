import ContactMessage from '../models/ContactMessage.js';
import { serializeContactMessage } from '../utils/serializers.js';
import { HttpError } from '../utils/api.js';
import { createNotification } from '../services/notificationService.js';
import { sendContactThankYou, getSettings } from '../services/emailService.js';
import { logAudit } from '../services/auditService.js';

export async function createContact(req, res) {
  const { name, email, phone, subject, message } = req.body || {};
  if (!name || !email || !message) {
    throw new HttpError(400, 'Name, email and message are required');
  }

  const contact = await ContactMessage.create({
    name,
    email: String(email).toLowerCase().trim(),
    phone: phone || '',
    subject: subject || '',
    message,
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
  const contacts = await ContactMessage.find().sort({ createdAt: -1 }).lean();
  return res.json(contacts.map(serializeContactMessage));
}

export async function updateContact(req, res) {
  const contact = await ContactMessage.findById(req.params.id);
  if (!contact) throw new HttpError(404, 'Message not found');

  const b = req.body || {};
  if (b.status !== undefined) contact.status = b.status;
  if (b.replyText !== undefined) contact.replyText = b.replyText;
  if (b.reply_text !== undefined) contact.replyText = b.reply_text;
  if (b.status === 'replied' && !contact.repliedAt) contact.repliedAt = new Date();
  if (b.status === 'read' && contact.status === 'new') contact.status = 'read';

  await contact.save();
  return res.json(serializeContactMessage(contact.toObject()));
}

export async function replyContact(req, res) {
  const contact = await ContactMessage.findById(req.params.id);
  if (!contact) throw new HttpError(404, 'Message not found');

  const { replyText } = req.body || {};
  if (!replyText) throw new HttpError(400, 'Reply text is required');

  contact.replyText = replyText;
  contact.status = 'replied';
  contact.repliedAt = new Date();
  await contact.save();

  const settings = await getSettings();
  const { sendEmail } = await import('../services/emailService.js');
  await sendEmail({
    to: contact.email,
    subject: `Re: ${contact.subject || 'Your message to ' + (settings.businessName || 'Tripod Wellness')}`,
    html: `<p>Dear <strong>${contact.name}</strong>,</p><p>${String(replyText).replace(/\n/g, '<br/>')}</p>`,
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
  const res2 = await ContactMessage.deleteMany({ _id: { $in: ids } });
  await logAudit({ action: 'bulk_delete', module: 'contacts', details: `Deleted ${res2.deletedCount} messages`, req });
  return res.json({ success: true, count: res2.deletedCount });
}

export default { createContact, listContacts, updateContact, replyContact, deleteContact, bulkDeleteContacts };