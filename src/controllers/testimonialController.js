import Testimonial from '../models/Testimonial.js';
import { serializeTestimonial } from '../utils/serializers.js';
import { HttpError } from '../utils/api.js';
import { logAudit } from '../services/auditService.js';

function normalizeBody(b) {
  const out = {};
  if (b.name !== undefined) out.name = b.name;
  if (b.clientName !== undefined) out.name = b.clientName;
  if (b.role !== undefined) out.role = b.role;
  if (b.rating !== undefined) out.rating = Number(b.rating) || 5;
  if (b.comment !== undefined) out.comment = b.comment;
  if (b.serviceTitle !== undefined) out.serviceTitle = b.serviceTitle;
  if (b.service_title !== undefined) out.serviceTitle = b.service_title;
  if (b.date !== undefined) out.date = b.date ? new Date(b.date) : undefined;
  if (b.avatarUrl !== undefined) out.avatarUrl = b.avatarUrl;
  if (b.avatar_url !== undefined) out.avatarUrl = b.avatar_url;
  if (b.approved !== undefined) out.approved = b.approved === true || b.approved === 1 || b.approved === '1';
  return out;
}

export async function listTestimonials(req, res) {
  const query = req.query.all === '1' ? {} : { approved: true };
  const items = await Testimonial.find(query).sort({ createdAt: -1 }).lean();
  return res.json(items.map(serializeTestimonial));
}

export async function createTestimonial(req, res) {
  const data = normalizeBody(req.body);
  if (!data.name || !data.comment) throw new HttpError(400, 'Name and comment are required');

  const item = await Testimonial.create(data);
  await logAudit({ action: 'create', module: 'testimonials', details: `Added testimonial from ${item.name}`, req });
  return res.status(201).json(serializeTestimonial(item.toObject()));
}

export async function deleteTestimonial(req, res) {
  const item = await Testimonial.findById(req.params.id);
  if (!item) throw new HttpError(404, 'Testimonial not found');

  await item.deleteOne();
  await logAudit({ action: 'delete', module: 'testimonials', details: `Removed testimonial from ${item.name}`, req });
  return res.json({ success: true });
}

export default { listTestimonials, createTestimonial, deleteTestimonial };