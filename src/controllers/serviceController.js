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
  if (b.price !== undefined) out.price = Number(b.price) || 0;
  if (b.original_price !== undefined) out.originalPrice = Number(b.original_price) || null;
  if (b.originalPrice !== undefined) out.originalPrice = Number(b.originalPrice) || null;
  if (b.duration_minutes !== undefined) out.durationMinutes = Number(b.duration_minutes) || 60;
  if (b.durationMinutes !== undefined) out.durationMinutes = Number(b.durationMinutes) || 60;
  if (b.benefits !== undefined) out.benefits = b.benefits;
  if (b.included_items !== undefined) out.includedItems = b.included_items;
  if (b.includedItems !== undefined) out.includedItems = b.includedItems;
  if (b.image_url !== undefined) out.imageUrl = b.image_url;
  if (b.imageUrl !== undefined) out.imageUrl = b.imageUrl;
  if (b.featured !== undefined) out.featured = b.featured === true || b.featured === 1 || b.featured === '1';
  if (b.active !== undefined) out.active = !(b.active === false || b.active === 0 || b.active === '0');
  if (b.rating !== undefined) out.rating = Number(b.rating) || 0;
  if (b.reviews_count !== undefined) out.reviewsCount = Number(b.reviews_count) || 0;
  if (b.reviewsCount !== undefined) out.reviewsCount = Number(b.reviewsCount) || 0;
  if (b.faq !== undefined) out.faq = Array.isArray(b.faq) ? b.faq : [];
  return out;
}

export async function listServices(req, res) {
  const services = await Service.find().sort({ createdAt: -1 }).lean();
  return res.json(services.map(serializeService));
}

export async function createService(req, res) {
  const data = normalizeBody(req.body);
  if (!data.title) throw new HttpError(400, 'Service title is required');

  const slug = req.body.slug ? req.body.slug : await uniqueSlug(Service, data.title);
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