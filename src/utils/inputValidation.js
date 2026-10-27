import { z } from 'zod';
import { stripHtml } from './htmlTruncate.js';

/** Strip HTML and normalize whitespace for plain-text fields. */
export function cleanText(value, maxLength = 2000) {
  if (value === undefined || value === null) return '';
  return stripHtml(String(value))
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

export function cleanSingleLine(value, maxLength = 200) {
  return cleanText(value, maxLength).replace(/\s+/g, ' ').trim();
}

export function cleanEmail(value) {
  return String(value || '').toLowerCase().trim().slice(0, 254);
}

/** A filled honeypot is treated as a bot submission and silently discarded. */
export function isHoneypotFilled(body = {}) {
  return Boolean(String(body.website || body.website_url || body.company || '').trim());
}

const email = z.string().trim().max(500).email();

export const contactInputSchema = z.object({
  name: z.string().trim().min(1).max(500),
  email,
  phone: z.string().max(80).optional().default(''),
  subject: z.string().max(500).optional().default(''),
  message: z.string().trim().min(1).max(12000),
  consent: z.literal(true),
  website: z.string().max(500).optional().default(''),
});

export const newsletterInputSchema = z.object({
  email,
  consent: z.literal(true),
  website: z.string().max(500).optional().default(''),
});

export const bookingInputSchema = z.object({
  customerName: z.string().max(300).optional().default(''),
  firstName: z.string().max(120).optional().default(''),
  lastName: z.string().max(120).optional().default(''),
  email,
  phone: z.string().max(80),
  age: z.union([z.number(), z.string()]).optional(),
  gender: z.string().max(80).optional().default(''),
  serviceId: z.string().max(120).optional().default(''),
  serviceTitle: z.string().max(300).optional().default(''),
  therapistId: z.string().max(120).optional().default('any'),
  therapistName: z.string().max(300).optional().default(''),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeSlot: z.string().trim().max(20),
  couponCode: z.string().max(60).optional().default(''),
  discountAmount: z.union([z.number(), z.string()]).optional(),
  totalPaid: z.union([z.number(), z.string()]).optional(),
  notes: z.string().max(4000).optional().default(''),
  additionalNotes: z.string().max(4000).optional().default(''),
  paymentMethod: z.literal('pay_at_venue').optional().default('pay_at_venue'),
  consent: z.literal(true),
  website: z.string().max(500).optional().default(''),
});

export const applicationInputSchema = z.object({
  name: z.string().trim().min(1).max(500),
  email,
  password: z.string().min(8).max(200),
  requestedRole: z.string().max(80).optional().default('Receptionist'),
  note: z.string().max(4000).optional().default(''),
  consent: z.literal(true),
  website: z.string().max(500).optional().default(''),
});

export function parseOrThrow(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    const field = first?.path?.join('.') || 'request';
    const message = first?.message || 'Invalid request';
    const err = new Error(`${field}: ${message}`);
    err.status = 400;
    err.isValidationError = true;
    throw err;
  }
  return result.data;
}

export default {
  cleanText,
  cleanSingleLine,
  cleanEmail,
  isHoneypotFilled,
  contactInputSchema,
  newsletterInputSchema,
  bookingInputSchema,
  applicationInputSchema,
  parseOrThrow,
};
