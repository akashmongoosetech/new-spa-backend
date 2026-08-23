import Faq from '../models/Faq.js';
import { HttpError, sendError } from '../utils/api.js';
import { logAudit } from '../services/auditService.js';

function serializeFaq(f) {
  if (!f) return null;
  return {
    id: f._id ? f._id.toString() : f.id,
    question: f.question,
    answer: f.answer,
    category: f.category || 'general',
    order: f.order || 0,
    active: f.active === false || f.active === 0 ? 0 : 1,
    isPublished: f.isPublished === true || f.isPublished === 1 ? 1 : 0,
  };
}

function normalizeBody(b) {
  const out = {};
  if (b.question !== undefined) out.question = b.question;
  if (b.answer !== undefined) out.answer = b.answer;
  if (b.category !== undefined) out.category = b.category;
  if (b.order !== undefined) out.order = Number(b.order) || 0;
  if (b.active !== undefined) out.active = !(b.active === false || b.active === 0 || b.active === '0');
  if (b.isPublished !== undefined) out.isPublished = b.isPublished === true || b.isPublished === 1 || b.isPublished === '1';
  return out;
}

export async function listFaqs(req, res) {
  const { published } = req.query || {};
  
  // published='all' → show all (admin); published=true/false → filter; undefined → active + published
  const query = published === 'all'
    ? {}
    : published === 'true'
      ? { isPublished: true }
      : published === 'false'
        ? { isPublished: false }
        : { isPublished: true, active: true };
  
  const items = await Faq.find(query).sort({ order: 1, createdAt: 1 }).lean();
  return res.json(items.map(serializeFaq));
}

export async function createFaq(req, res) {
  const data = normalizeBody(req.body);
  if (!data.question || !data.answer) {
    throw new HttpError(400, 'Question and answer are required');
  }
  const item = await Faq.create(data);
  await logAudit({ action: 'create', module: 'faqs', details: `Added FAQ: ${item.question}`, req });
  return res.status(201).json(serializeFaq(item.toObject()));
}

export async function updateFaq(req, res) {
  const item = await Faq.findById(req.params.id);
  if (!item) throw new HttpError(404, 'FAQ not found');

  Object.assign(item, normalizeBody(req.body));
  await item.save();
  await logAudit({ action: 'update', module: 'faqs', details: `Updated FAQ: ${item.question}`, req });
  return res.json(serializeFaq(item.toObject()));
}

export async function deleteFaq(req, res) {
  const item = await Faq.findById(req.params.id);
  if (!item) throw new HttpError(404, 'FAQ not found');

  await item.deleteOne();
  await logAudit({ action: 'delete', module: 'faqs', details: `Deleted FAQ: ${item.question}`, req });
  return res.json({ success: true });
}

export async function toggleFaqStatus(req, res) {
  const item = await Faq.findById(req.params.id);
  if (!item) throw new HttpError(404, 'FAQ not found');

  // Authorization: Super Admin, Admin, or Manager only
  if (req.user.role !== 'Super Admin' && req.user.role !== 'Admin' && req.user.role !== 'Manager') {
    return sendError(res, 403, 'You do not have permission');
  }

  item.isPublished = !item.isPublished;
  await item.save();
  return res.json(serializeFaq(item.toObject()));
}

export default { listFaqs, createFaq, updateFaq, deleteFaq, toggleFaqStatus };