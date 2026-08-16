import { v4 as uuidv4 } from 'uuid';
import { ContactModel } from '../models/ContactModel.js';
import { sendError, sendSuccess, handleError } from '../utils/responseHandler.js';
import { createNotification } from '../services/notificationService.js';
import { sendMail } from '../services/emailService.js';

export const getContacts = (req, res) => {
  try {
    const contacts = ContactModel.getAll();
    return res.json(contacts);
  } catch (err) {
    return handleError(res, err);
  }
};

export const createContact = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !message) {
      return sendError(res, 'Name, email, and message are required', 400);
    }

    const id = `cnt-${uuidv4().slice(0, 8)}`;
    const newContact = ContactModel.create({
      id, name, email, phone, subject, message
    });

    createNotification(
      'New Inquiry Received',
      `${name} submitted an inquiry: "${subject || 'General Inquiry'}"`,
      'contact',
      '/admin/contacts'
    );

    sendMail({
      to: email,
      subject: 'Thank you for contacting Aura Luxe Spa',
      html: `<p>Dear ${name},</p><p>Thank you for reaching out to Aura Luxe Spa. Our concierge team has received your inquiry and will respond within 24 hours.</p>`
    });

    return res.status(201).json(newContact);
  } catch (err) {
    return handleError(res, err);
  }
};

export const replyContact = async (req, res) => {
  try {
    const { id } = req.params;
    const { replyMessage } = req.body;
    if (!replyMessage) return sendError(res, 'Reply message is required', 400);

    const contact = ContactModel.getById(id);
    if (!contact) return sendError(res, 'Contact inquiry not found', 404);

    const updated = ContactModel.reply(id, replyMessage);

    sendMail({
      to: contact.email,
      subject: `Re: ${contact.subject || 'Aura Luxe Spa Inquiry'}`,
      html: `<p>Dear ${contact.name},</p><p>${replyMessage}</p><br/><p>Warm regards,<br/>Aura Luxe Spa Concierge</p>`
    });

    return res.json(updated);
  } catch (err) {
    return handleError(res, err);
  }
};

export const updateContactStatus = (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = ContactModel.updateStatus(id, status);
    return res.json(updated);
  } catch (err) {
    return handleError(res, err);
  }
};

export const deleteContact = (req, res) => {
  try {
    ContactModel.delete(req.params.id);
    return sendSuccess(res, null, 'Contact inquiry deleted successfully');
  } catch (err) {
    return handleError(res, err);
  }
};

export const bulkDeleteContacts = (req, res) => {
  try {
    const { ids } = req.body;
    ContactModel.bulkDelete(ids);
    return sendSuccess(res, null, 'Selected contact inquiries deleted successfully');
  } catch (err) {
    return handleError(res, err);
  }
};
