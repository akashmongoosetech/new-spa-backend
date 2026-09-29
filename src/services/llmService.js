import env from '../config/env.js';
import logger from '../utils/logger.js';

function endpoint(action) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    env.llm.model
  )}:${action}`;
}

function headers() {
  return { 'Content-Type': 'application/json', 'x-goog-api-key': env.llm.apiKey };
}

function extractText(data) {
  return (
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join(' ').trim() || ''
  );
}

function toContents(history, message) {
  const contents = [];
  for (const h of (Array.isArray(history) ? history : []).slice(-6)) {
    const sender = h.sender || h.role || 'user';
    const text = String(h.content || h.text || '').slice(0, 1000);
    if (!text.trim()) continue;
    contents.push({
      role: sender === 'assistant' || sender === 'model' ? 'model' : 'user',
      parts: [{ text }],
    });
  }
  contents.push({ role: 'user', parts: [{ text: String(message || '').slice(0, 1000) }] });
  return contents;
}

/**
 * Single-shot generation with a proper system instruction (not smuggled
 * in as a user turn) and low temperature for grounded answers.
 */
export async function generateResponse({ system, history, message, maxTokens }) {
  if (!env.llm.apiKey) throw new Error('LLM API key not configured');
  const started = Date.now();
  const resp = await fetch(endpoint('generateContent'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      system_instruction: { parts: [{ text: String(system || '').slice(0, 4000) }] },
      contents: toContents(history, message),
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: maxTokens || env.llm.maxOutputTokens,
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!resp.ok) {
    logger.error('rag', `LLM HTTP ${resp.status}`);
    throw new Error(`LLM HTTP ${resp.status}`);
  }
  const data = await resp.json();
  const text = extractText(data);
  if (!text) throw new Error('Empty LLM response');
  return { text, latencyMs: Date.now() - started, tokens: data?.usageMetadata?.totalTokenCount || null };
}

/**
 * Streaming generation. Calls onToken(text) per chunk; resolves with the
 * full text + latency. Uses generateContent:streamContent SSE format.
 */
export async function streamResponse({ system, history, message, maxTokens, onToken, signal }) {
  if (!env.llm.apiKey) throw new Error('LLM API key not configured');
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), env.llm.sseTimeoutMs);
  // signal must be a real AbortSignal — callers sometimes pass framework
  // objects (e.g. Express req). Guard so a bad signal can never crash the
  // stream; client-disconnect abort is wired by the caller when available.
  if (signal && typeof signal.addEventListener === 'function') {
    signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  try {
    const resp = await fetch(endpoint('streamGenerateContent') + '?alt=sse', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        system_instruction: { parts: [{ text: String(system || '').slice(0, 4000) }] },
        contents: toContents(history, message),
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: maxTokens || env.llm.maxOutputTokens,
        },
      }),
      signal: ctrl.signal,
    });
    if (!resp.ok || !resp.body) throw new Error(`LLM stream HTTP ${resp.status}`);
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let full = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // Gemini SSE uses \r\n line endings, so split on either flavour.
      const parts = buf.split(/\r?\n\r?\n/);
      buf = parts.pop() || '';
      for (const part of parts) {
        const line = part.trim().split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const text = extractText(JSON.parse(payload));
          if (text) {
            full += (full ? ' ' : '') + text;
            if (onToken) onToken(text);
          }
        } catch {
          /* skip malformed chunk */
        }
      }
    }
    if (!full.trim()) throw new Error('Empty LLM stream');
    return { text: full.trim(), latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

export default { generateResponse, streamResponse };
