import mongoose from 'mongoose';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import KnowledgeChunk from '../models/KnowledgeChunk.js';
import { generateEmbedding } from './embeddingService.js';

const INDEX_NAME = 'knowledge_vec_idx';
let atlasChecked = null;

async function atlasAvailable() {
  if (atlasChecked !== null) return atlasChecked;
  try {
    const indexes = await KnowledgeChunk.collection.listSearchIndexes().toArray();
    atlasChecked = indexes.some((i) => i.name === INDEX_NAME);
  } catch {
    atlasChecked = false; // local mongod without search nodes
  }
  if (atlasChecked === false) {
    logger.warn('rag', 'Atlas vector index missing — using keyword fallback');
  }
  return atlasChecked;
}

async function vectorSearch(vector, { category, limit }) {
  const pipeline = [
    {
      $vectorSearch: {
        index: INDEX_NAME,
        path: 'embedding',
        queryVector: vector,
        numCandidates: Math.max(100, limit * 20),
        limit,
      },
    },
    { $match: { accessLevel: 'public', ...(category ? { category } : {}) } },
    {
      $project: {
        source: 1,
        documentId: 1,
        title: 1,
        category: 1,
        url: 1,
        text: 1,
        updatedAt: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ];
  return KnowledgeChunk.aggregate(pipeline);
}

async function keywordSearch(query, { category, limit }) {
  const words = String(query || '')
    .toLowerCase()
    .split(/[^a-z0-9₹]+/)
    .filter((w) => w.length > 2)
    .slice(0, 12);
  if (!words.length) return [];
  const or = words.flatMap((w) => [
    { title: { $regex: w, $options: 'i' } },
    { text: { $regex: w, $options: 'i' } },
    { category: { $regex: w, $options: 'i' } },
  ]);
  const docs = await KnowledgeChunk.find({
    accessLevel: 'public',
    ...(category ? { category } : {}),
    $or: or,
  })
    .select('source documentId title category url text updatedAt')
    .limit(limit * 3)
    .lean();
  // Thin relevance: fraction of query words matched, then recency.
  return docs
    .map((d) => {
      const hay = `${d.title} ${d.text} ${d.category}`.toLowerCase();
      const hits = words.filter((w) => hay.includes(w)).length;
      return { ...d, score: hits / words.length };
    })
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, limit);
}

/**
 * Retrieve grounded context. Returns { chunks, usedVector } where each
 * chunk carries a 0..1 score. Callers enforce the similarity threshold.
 */
export async function retrieve({ query, category = null, limit = null }) {
  const topK = limit || env.rag.topK;
  let chunks = [];
  let usedVector = false;
  try {
    if (env.llm.apiKey && (await atlasAvailable())) {
      const vector = await generateEmbedding(query);
      chunks = await vectorSearch(vector, { category, limit: topK });
      usedVector = true;
    }
  } catch (err) {
    logger.error('rag', 'Vector search failed, falling back to keyword', err);
  }
  if (!chunks.length) {
    chunks = await keywordSearch(query, { category, limit: topK });
  }
  return { chunks, usedVector };
}

export function thinRerank(chunks, limit = null) {
  const topK = limit || env.rag.topK;
  return [...chunks]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, topK);
}

export default { retrieve, thinRerank };
