import GalleryItem from '../models/GalleryItem.js';
import { serializeGalleryItem } from '../utils/serializers.js';
import { HttpError } from '../utils/api.js';
import { logAudit } from '../services/auditService.js';

export async function listGallery(req, res) {
  const items = await GalleryItem.find().sort({ createdAt: -1 }).lean();
  return res.json(items.map(serializeGalleryItem));
}

export async function createGalleryItem(req, res) {
  const b = req.body || {};
  const { title, imageUrl, image_url } = b;
  const url = imageUrl || image_url;
  if (!url) throw new HttpError(400, 'imageUrl is required');

  const item = await GalleryItem.create({
    title: title || '',
    subtitle: b.subtitle || b.sub_title || '',
    category: b.category || '',
    categoryLabel: b.categoryLabel || b.category_label || '',
    imageUrl: url,
    description: b.description || '',
    highlights: Array.isArray(b.highlights) ? b.highlights : [],
    dimensions: b.dimensions || '',
    sanitizationLevel: b.sanitizationLevel || b.sanitization_level || '',
  });
  await logAudit({ action: 'create', module: 'gallery', details: `Added gallery item "${item.title}"`, req });
  return res.status(201).json(serializeGalleryItem(item.toObject()));
}

export async function deleteGalleryItem(req, res) {
  const item = await GalleryItem.findById(req.params.id);
  if (!item) throw new HttpError(404, 'Gallery item not found');

  await item.deleteOne();
  await logAudit({ action: 'delete', module: 'gallery', details: `Removed gallery item "${item.title}"`, req });
  return res.json({ success: true });
}

export default { listGallery, createGalleryItem, deleteGalleryItem };