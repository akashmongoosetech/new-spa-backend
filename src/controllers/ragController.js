import { HttpError } from '../utils/api.js';
import { ingestAll, ingestSource, sourceStats } from '../services/ingestService.js';
import { retrieve, thinRerank } from '../services/retrievalService.js';
import { lowConfidenceQueue } from '../services/chatService.js';
import ChatMessage from '../models/ChatMessage.js';
import env from '../config/env.js';

const SOURCES = ['service', 'therapist', 'faq', 'blog', 'business'];

export async function getSources(req, res) {
  return res.json({ sources: await sourceStats() });
}

export async function reindex(req, res) {
  const { source } = req.body || {};
  if (source !== undefined && !SOURCES.includes(source)) {
    throw new HttpError(400, 'Invalid source');
  }
  const result = source ? [await ingestSource(source)] : await ingestAll();
  return res.json({ success: true, result });
}

export async function deleteSource(req, res) {
  const { source } = req.params;
  if (!SOURCES.includes(source)) throw new HttpError(400, 'Invalid source');
  const { default: KnowledgeChunk } = await import('../models/KnowledgeChunk.js');
  const r = await KnowledgeChunk.deleteMany({ source });
  return res.json({ success: true, deleted: r.deletedCount });
}

/** Retrieval dry-run: chunks + scores without spending LLM tokens. */
export async function testRetrieval(req, res) {
  const { query, category } = req.body || {};
  const q = String(query || '').trim().slice(0, 500);
  if (!q) throw new HttpError(400, 'A query is required');
  const { chunks, usedVector } = await retrieve({ query: q, category: category || null, limit: 8 });
  const ranked = thinRerank(chunks, 8);
  return res.json({
    query: q,
    usedVector,
    threshold: env.rag.similarityThreshold,
    chunks: ranked.map((c) => ({
      title: c.title,
      source: c.source,
      category: c.category,
      url: c.url,
      score: c.score,
      excerpt: String(c.text || '').slice(0, 280),
    })),
  });
}

export async function reviewQueue(req, res) {
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10) || 50));
  return res.json({ items: await lowConfidenceQueue(limit) });
}

export async function usageStats(req, res) {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const agg = await ChatMessage.aggregate([
    { $match: { role: 'assistant', createdAt: { $gte: since } } },
    {
      $group: {
        _id: null,
        answers: { $sum: 1 },
        lowConfidence: { $sum: { $cond: ['$lowConfidence', 1, 0] } },
        tokens: { $sum: '$tokens' },
        avgLatencyMs: { $avg: '$latencyMs' },
      },
    },
  ]);
  const a = agg[0] || {};
  return res.json({
    answers7d: a.answers || 0,
    lowConfidence7d: a.lowConfidence || 0,
    tokens7d: a.tokens || 0,
    avgLatencyMs: Math.round(a.avgLatencyMs || 0),
    model: env.llm.model,
    embeddingModel: env.embeddings.model,
    topK: env.rag.topK,
    threshold: env.rag.similarityThreshold,
  });
}

export default { getSources, reindex, deleteSource, testRetrieval, reviewQueue, usageStats };
