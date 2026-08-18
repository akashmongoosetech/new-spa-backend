import Therapist from '../models/Therapist.js';
import { serializeTherapist } from '../utils/serializers.js';
import { HttpError } from '../utils/api.js';
import { logAudit } from '../services/auditService.js';

function normalizeBody(body) {
  const out = {};
  const b = body || {};
  if (b.name !== undefined) out.name = b.name;
  if (b.title !== undefined) out.title = b.title;
  if (b.experience_years !== undefined) out.experienceYears = Number(b.experience_years) || 0;
  if (b.experienceYears !== undefined) out.experienceYears = Number(b.experienceYears) || 0;
  if (b.bio !== undefined) out.bio = b.bio;
  if (b.specialties !== undefined) out.specialties = b.specialties;
  if (b.image_url !== undefined) out.imageUrl = b.image_url;
  if (b.imageUrl !== undefined) out.imageUrl = b.imageUrl;
  if (b.photoUrl !== undefined) out.photoUrl = b.photoUrl;
  if (b.gallery !== undefined) out.gallery = b.gallery;
  if (b.featured !== undefined) out.featured = b.featured === true || b.featured === 1 || b.featured === '1';
  if (b.rating !== undefined) out.rating = Number(b.rating) || 0;
  if (b.reviews_count !== undefined) out.reviewsCount = Number(b.reviews_count) || 0;
  if (b.reviewsCount !== undefined) out.reviewsCount = Number(b.reviewsCount) || 0;
  if (b.availableDays !== undefined) out.availableDays = b.availableDays;
  if (b.available_days !== undefined) out.availableDays = b.available_days;
  if (b.availability !== undefined) out.availability = b.availability;
  if (b.active !== undefined) out.active = !(b.active === false || b.active === 0 || b.active === '0');
  return out;
}

export async function listTherapists(req, res) {
  const therapists = await Therapist.find().sort({ createdAt: -1 }).lean();
  return res.json(therapists.map(serializeTherapist));
}

export async function createTherapist(req, res) {
  const data = normalizeBody(req.body);
  if (!data.name) throw new HttpError(400, 'Therapist name is required');

  const therapist = await Therapist.create(data);
  await logAudit({ action: 'create', module: 'therapists', details: `Created therapist "${therapist.name}"`, req });
  return res.status(201).json(serializeTherapist(therapist.toObject()));
}

export async function updateTherapist(req, res) {
  const therapist = await Therapist.findById(req.params.id);
  if (!therapist) throw new HttpError(404, 'Therapist not found');

  Object.assign(therapist, normalizeBody(req.body));
  await therapist.save();

  await logAudit({ action: 'update', module: 'therapists', details: `Updated therapist "${therapist.name}"`, req });
  return res.json(serializeTherapist(therapist.toObject()));
}

export async function deleteTherapist(req, res) {
  const therapist = await Therapist.findById(req.params.id);
  if (!therapist) throw new HttpError(404, 'Therapist not found');

  await therapist.deleteOne();
  await logAudit({ action: 'delete', module: 'therapists', details: `Deleted therapist "${therapist.name}"`, req });
  return res.json({ success: true });
}

export default { listTherapists, createTherapist, updateTherapist, deleteTherapist };