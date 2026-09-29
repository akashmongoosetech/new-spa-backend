import env from '../config/env.js';
import logger from '../utils/logger.js';
import KnowledgeChunk from '../models/KnowledgeChunk.js';
import Service from '../models/Service.js';
import Therapist from '../models/Therapist.js';
import Faq from '../models/Faq.js';
import Blog from '../models/Blog.js';
import Setting from '../models/Setting.js';
import { generateBatchEmbeddings } from './embeddingService.js';

const NAV_JUNK_RE = /\b(home|login|sign in|subscribe|newsletter|copyright|all rights reserved)\b/gi;

export function cleanText(raw) {
  return String(raw || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(NAV_JUNK_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function chunkText(text, size = null, overlap = null) {
  const s = size || env.rag.chunkSize;
  const o = Math.min(overlap ?? env.rag.chunkOverlap, Math.floor(s / 2));
  const clean = cleanText(text);
  if (!clean) return [];
  if (clean.length <= s) return [clean];
  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + s, clean.length);
    if (end < clean.length) {
      const space = clean.lastIndexOf(' ', end);
      if (space > start + s * 0.5) end = space;
    }
    const piece = clean.slice(start, end).trim();
    if (piece.length > 40) chunks.push(piece);
    if (end >= clean.length) break;
    start = end - o;
  }
  return chunks;
}

function docToUnits(doc) {
  // Service → one chunk per service (short, factual) + FAQ sub-docs.
  if (doc.__source === 'service') {
    const parts = [
      `${doc.title}. Category: ${doc.category || 'general'}. Price: ₹${doc.price}${
        doc.originalPrice ? ` (was ₹${doc.originalPrice})` : ''
      }. Duration: ${doc.durationMinutes || 60} minutes.`,
      doc.shortDescription || '',
      doc.fullDescription || '',
      `Benefits: ${(doc.benefits || []).join('; ')}`,
      `Included: ${(doc.includedItems || []).join('; ')}`,
    ].filter(Boolean);
    return [
      {
        title: doc.title,
        category: doc.category || 'general',
        url: `/services/${doc.slug || ''}`,
        text: parts.join(' '),
      },
      ...((doc.faq || []).map((f) => ({
        title: `${doc.title} — ${f.question || 'FAQ'}`,
        category: doc.category || 'general',
        url: `/services/${doc.slug || ''}`,
        text: `Q: ${f.question || ''} A: ${f.answer || ''}`,
      }))),
    ];
  }
  if (doc.__source === 'therapist') {
    return [
      {
        title: doc.name,
        category: 'therapist',
        url: '/therapists',
        text: `${doc.name}, ${doc.title || 'therapist'}. Experience: ${doc.experienceYears || ''} years. Specialties: ${(doc.specialties || []).join(', ')}. ${(doc.bio || '').slice(0, 600)}`,
      },
    ];
  }
  if (doc.__source === 'faq') {
    return [
      {
        title: doc.question,
        category: doc.category || 'general',
        url: '/faq',
        text: `Q: ${doc.question} A: ${doc.answer}`,
      },
    ];
  }
  if (doc.__source === 'blog') {
    return [
      {
        title: doc.title,
        category: doc.category || 'blog',
        url: `/blog/${doc.slug || ''}`,
        text: `${doc.title}. ${doc.excerpt || doc.summary || ''} ${cleanText(doc.content).slice(0, 1500)}`,
      },
    ];
  }
  return [];
}

async function collectSource(source) {
  if (source === 'service') {
    const docs = await Service.find({ active: { $ne: false } }).lean();
    return docs.map((d) => ({ ...d, __source: 'service', _docId: d._id.toString() }));
  }
  if (source === 'therapist') {
    const docs = await Therapist.find({ active: { $ne: false } }).lean();
    return docs.map((d) => ({ ...d, __source: 'therapist', _docId: d._id.toString() }));
  }
  if (source === 'faq') {
    const docs = await Faq.find({ isPublished: true, active: true }).lean();
    return docs.map((d) => ({ ...d, __source: 'faq', _docId: d._id.toString() }));
  }
  if (source === 'blog') {
    const docs = await Blog.find({ published: true, status: 'active' }).lean();
    return docs.map((d) => ({ ...d, __source: 'blog', _docId: d._id.toString() }));
  }
  if (source === 'business') {
    const s = (await Setting.findOne({ key: 'default' }).lean()) || {};
    return [
      {
        __source: 'business',
        _docId: 'business-profile',
        title: s.businessName || 'Tripod Wellness',
        category: 'business',
        url: '/contact',
        text: `${s.businessName || 'Tripod Wellness'}. ${s.tagline || ''} Address: ${s.address || ''}, ${s.city || ''}. Phone: ${s.phone || ''}. Email: ${s.email || ''}. Hours: ${s.workingHours || ''}. Advance booking: ${s.advanceBookingDays || 30} days. Cancellation notice: ${s.cancellationNoticeHours || 4} hours.`,
      },
    ];
  }
  throw new Error(`Unknown source: ${source}`);
}

/**
 * Rebuild one source: delete its chunks, re-chunk, embed, insert.
 * Embeddings are best-effort — chunks without vectors still serve
 * keyword retrieval, so ingestion never hard-fails the corpus.
 */
export async function ingestSource(source) {
  const docs = await collectSource(source);
  const units = [];
  for (const doc of docs) {
    const isRawBusiness = doc.__source === 'business';
    const rawUnits = isRawBusiness
      ? [{ title: doc.title, category: doc.category, url: doc.url, text: doc.text }]
      : docToUnits(doc);
    for (const u of rawUnits) {
      for (const piece of chunkText(u.text)) {
        units.push({
          source,
          documentId: doc._docId,
          title: u.title,
          category: u.category,
          url: u.url,
          text: piece,
        });
      }
    }
  }

  await KnowledgeChunk.deleteMany({ source });

  let embedded = 0;
  if (units.length && env.llm.apiKey) {
    try {
      const vecs = await generateBatchEmbeddings(units.map((u) => `${u.title}. ${u.text}`));
      vecs.forEach((v, i) => {
        if (v) {
          units[i].embedding = v;
          embedded += 1;
        }
      });
    } catch (err) {
      logger.error('rag', `Embeddings failed for ${source}, storing text-only`, err);
    }
  }
  if (units.length) await KnowledgeChunk.insertMany(units, { ordered: false });
  logger.info('rag', `Ingested ${source}: ${units.length} chunks (${embedded} embedded)`);
  return { source, chunks: units.length, embedded, documents: docs.length };
}

export async function ingestAll() {
  const out = [];
  for (const source of ['service', 'therapist', 'faq', 'blog', 'business']) {
    try {
      out.push({ ...(await ingestSource(source)), ok: true });
    } catch (err) {
      logger.error('rag', `Ingest failed for ${source}`, err);
      out.push({ source, ok: false, error: err.message });
    }
  }
  return out;
}

/** Fire-and-forget hook for create/update/delete controller paths. */
export function refreshSource(source) {
  ingestSource(source).catch((err) => logger.error('rag', `Auto-refresh failed for ${source}`, err));
}

export async function sourceStats() {
  const agg = await KnowledgeChunk.aggregate([
    { $group: { _id: '$source', chunks: { $sum: 1 }, updatedAt: { $max: '$updatedAt' } } },
  ]);
  const bySource = Object.fromEntries(agg.map((a) => [a._id, a]));
  return ['service', 'therapist', 'faq', 'blog', 'business'].map((s) => ({
    source: s,
    chunks: bySource[s]?.chunks || 0,
    updatedAt: bySource[s]?.updatedAt || null,
    status: (bySource[s]?.chunks || 0) > 0 ? 'indexed' : 'empty',
  }));
}

export default { ingestSource, ingestAll, refreshSource, sourceStats, chunkText, cleanText };
