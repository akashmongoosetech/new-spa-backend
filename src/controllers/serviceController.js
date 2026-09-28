import Service from '../models/Service.js';
import { uniqueSlug } from '../utils/slugify.js';
import { serializeService } from '../utils/serializers.js';
import { HttpError } from '../utils/api.js';
import { logAudit } from '../services/auditService.js';

function normalizeBody(body) {
  const out = {};
  const b = body || {};
  if (b.title !== undefined) out.title = b.title;
  if (b.category !== undefined) out.category = b.category;
  if (b.short_description !== undefined) out.shortDescription = b.short_description;
  if (b.shortDescription !== undefined) out.shortDescription = b.shortDescription;
  if (b.full_description !== undefined) out.fullDescription = b.full_description;
  if (b.fullDescription !== undefined) out.fullDescription = b.fullDescription;
  if (b.price !== undefined) {
    const n = Number(b.price);
    if (!Number.isFinite(n) || n < 0) throw new HttpError(400, 'Invalid price');
    out.price = n;
  }
  if (b.original_price !== undefined) {
    const n = Number(b.original_price);
    out.originalPrice = Number.isFinite(n) && n >= 0 ? n : null;
  }
  if (b.originalPrice !== undefined) {
    const n = Number(b.originalPrice);
    out.originalPrice = Number.isFinite(n) && n >= 0 ? n : null;
  }
  if (b.duration_minutes !== undefined) {
    const n = Number(b.duration_minutes);
    if (!Number.isFinite(n) || n < 15 || n > 480) throw new HttpError(400, 'Invalid duration');
    out.durationMinutes = n;
  }
  if (b.durationMinutes !== undefined) {
    const n = Number(b.durationMinutes);
    if (!Number.isFinite(n) || n < 15 || n > 480) throw new HttpError(400, 'Invalid duration');
    out.durationMinutes = n;
  }
  if (b.benefits !== undefined) out.benefits = b.benefits;
  if (b.included_items !== undefined) out.includedItems = b.included_items;
  if (b.includedItems !== undefined) out.includedItems = b.includedItems;
  if (b.image_url !== undefined) out.imageUrl = b.image_url;
  if (b.imageUrl !== undefined) out.imageUrl = b.imageUrl;
  if (b.featured !== undefined) out.featured = b.featured === true || b.featured === 1 || b.featured === '1';
  if (b.active !== undefined) out.active = !(b.active === false || b.active === 0 || b.active === '0');
  if (b.rating !== undefined) {
    const n = Number(b.rating);
    if (!Number.isFinite(n) || n < 0 || n > 5) throw new HttpError(400, 'Rating must be 0-5');
    out.rating = n;
  }
  if (b.reviews_count !== undefined) {
    const n = Number(b.reviews_count);
    out.reviewsCount = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }
  if (b.reviewsCount !== undefined) {
    const n = Number(b.reviewsCount);
    out.reviewsCount = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }
  if (b.faq !== undefined) out.faq = Array.isArray(b.faq) ? b.faq : [];
  return out;
}

export async function listServices(req, res) {
  const services = await Service.find().sort({ createdAt: -1 }).limit(500).lean();
  return res.json(services.map(serializeService));
}

export async function createService(req, res) {
  const data = normalizeBody(req.body);
  if (!data.title) throw new HttpError(400, 'Service title is required');

  const rawSlug = req.body.slug || req.body.slug === '' ? req.body.slug : null;
  const slug = rawSlug ? String(rawSlug).toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').slice(0, 120) || await uniqueSlug(Service, data.title) : await uniqueSlug(Service, data.title);
  const service = await Service.create({ ...data, slug });

  await logAudit({ action: 'create', module: 'services', details: `Created service "${service.title}"`, req });
  return res.status(201).json(serializeService(service.toObject()));
}

export async function updateService(req, res) {
  const service = await Service.findById(req.params.id);
  if (!service) throw new HttpError(404, 'Service not found');

  const data = normalizeBody(req.body);
  if (req.body.slug) {
    service.slug = req.body.slug;
  } else if (data.title && data.title !== service.title) {
    service.slug = await uniqueSlug(Service, data.title, service._id);
  }

  Object.assign(service, data);
  await service.save();

  await logAudit({ action: 'update', module: 'services', details: `Updated service "${service.title}"`, req });
  return res.json(serializeService(service.toObject()));
}

export async function deleteService(req, res) {
  const service = await Service.findById(req.params.id);
  if (!service) throw new HttpError(404, 'Service not found');

  await service.deleteOne();
  await logAudit({ action: 'delete', module: 'services', details: `Deleted service "${service.title}"`, req });
  return res.json({ success: true });
}

export default { listServices, createService, updateService, deleteService };