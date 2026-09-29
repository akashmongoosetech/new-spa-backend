import env from '../config/env.js';
import logger from '../utils/logger.js';

// Simple TTL cache — identical queries within the window reuse vectors.
const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_TEXT = 2000;

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  if (cache.size > 1000) cache.clear();
  cache.set(key, { value, at: Date.now() });
}

async function embedGemini(texts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    env.embeddings.model
  )}:batchEmbedContents`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.llm.apiKey },
    body: JSON.stringify({
      requests: texts.map((t) => ({
        model: `models/${env.embeddings.model}`,
        content: { parts: [{ text: t }] },
        outputDimensionality: 768, // Matryoshka truncation: full quality at index size
      })),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`Embedding HTTP ${resp.status}`);
  const data = await resp.json();
  const out = (data.embeddings || []).map((e) => e.values || null);
  if (out.length !== texts.length || out.some((v) => !v)) {
    throw new Error('Incomplete embedding response');
  }
  return out;
}

/**
 * Provider abstraction — only Gemini is implemented; the call sites below
 * stay unchanged when another provider is added.
 */
export async function generateEmbedding(text) {
  const clean = String(text || '').trim().slice(0, MAX_TEXT);
  if (!clean) throw new Error('Empty text for embedding');
  if (!env.llm.apiKey) throw new Error('LLM API key not configured');
  const cached = cacheGet(clean);
  if (cached) return cached;
  const [vec] = await embedGemini([clean]);
  cacheSet(clean, vec);
  return vec;
}

export async function generateBatchEmbeddings(texts) {
  const clean = (Array.isArray(texts) ? texts : [])
    .map((t) => String(t || '').trim().slice(0, MAX_TEXT))
    .filter(Boolean);
  if (!clean.length) return [];
  if (!env.llm.apiKey) throw new Error('LLM API key not configured');
  const results = new Array(clean.length).fill(null);
  const pending = [];
  const pendingIdx = [];
  clean.forEach((t, i) => {
    const hit = cacheGet(t);
    if (hit) results[i] = hit;
    else {
      pending.push(t);
      pendingIdx.push(i);
    }
  });
  for (let i = 0; i < pending.length; i += 50) {
    const batch = pending.slice(i, i + 50);
    try {
      const vecs = await embedGemini(batch);
      vecs.forEach((v, j) => {
        results[pendingIdx[i + j]] = v;
        cacheSet(batch[j], v);
      });
    } catch (err) {
      logger.error('rag', 'Batch embedding failed', err);
      throw err;
    }
  }
  return results;
}

export function embeddingDim() {
  return 768; // gemini-embedding-001 truncated via outputDimensionality
}

export default { generateEmbedding, generateBatchEmbeddings, embeddingDim };
