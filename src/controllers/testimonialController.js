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
  if (req.query.all === '1') {
    const role = req.user && req.user.role;
    if (!req.user || !['Super Admin', 'Admin'].includes(role)) {
      throw new HttpError(403, 'You do not have permission to view unapproved testimonials');
    }
    const items = await Testimonial.find({}).sort({ createdAt: -1 }).limit(500).lean();
    return res.json(items.map(serializeTestimonial));
  }
  const items = await Testimonial.find({ approved: true }).sort({ createdAt: -1 }).limit(200).lean();
  return res.json(items.map(serializeTestimonial));
}

export async function updateTestimonial(req, res) {
  const item = await Testimonial.findById(req.params.id);
  if (!item) throw new HttpError(404, 'Testimonial not found');
  const b = req.body || {};
  if (b.name !== undefined) item.name = String(b.name).slice(0, 120);
  if (b.comment !== undefined) item.comment = String(b.comment).slice(0, 2000);
  if (b.role !== undefined) item.role = String(b.role).slice(0, 120);
  if (b.rating !== undefined) {
    const r = Number(b.rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) throw new HttpError(400, 'Rating must be 1-5');
    item.rating = r;
  }
  if (b.approved !== undefined) item.approved = b.approved === true || b.approved === 1 || b.approved === '1';
  await item.save();
  return res.json(serializeTestimonial(item.toObject()));
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

export default { listTestimonials, createTestimonial, updateTestimonial, deleteTestimonial };