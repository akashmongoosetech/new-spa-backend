import { HttpError } from '../utils/api.js';
import logger from '../utils/logger.js';
import {
  planTurn,
  answerTurn,
  streamAnswer,
  refusalText,
  answerCitations,
} from '../services/ragService.js';
import {
  getOrCreateConversation,
  getHistory,
  saveTurn,
  clearConversation,
} from '../services/chatService.js';

function cleanHistory(history) {
  if (history === undefined) return [];
  if (!Array.isArray(history)) throw new HttpError(400, 'Invalid history format');
  return history
    .slice(-6)
    .map((h) => {
      if (!h || typeof h !== 'object') return null;
      const sender = h.sender || h.role;
      const content = String(h.content || h.text || '').slice(0, 1000);
      if (!content.trim()) return null;
      return { sender: sender === 'assistant' || sender === 'model' ? 'assistant' : 'user', text: content };
    })
    .filter(Boolean);
}

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * POST /api/ai/chat — grounded RAG answer over Server-Sent Events.
 * Body: { conversationId?, message, history? }
 * Stream: `token` events, then `done {conversationId, answer, sources,
 * confidence, grounded}`. Errors arrive as JSON (never partial lies).
 */
export async function chatStream(req, res) {
  const { conversationId, message, history } = req.body || {};
  const text = String(message || '').trim().slice(0, 1000);
  if (!text) throw new HttpError(400, 'A message is required');
  const clean = cleanHistory(history);

  const convo = await getOrCreateConversation(conversationId, req);
  const started = Date.now();
  let plan;
  try {
    plan = await planTurn({ message: text, history: clean });
  } catch (err) {
    logger.error('rag', 'Planning failed', err);
    throw new HttpError(503, 'Assistant is temporarily unavailable. Please try again shortly.');
  }

  // Ungrounded → immediate refusal, still streamed as one done event.
  if (!plan.grounded) {
    const answer = refusalText(plan);
    const sources = answerCitations(plan);
    await saveTurn(convo.conversationId, {
      userText: text,
      answer,
      sources,
      confidence: plan.confidence,
      tokens: null,
      latencyMs: Date.now() - started,
      lowConfidence: true,
    });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    sse(res, 'done', {
      conversationId: convo.conversationId,
      answer,
      sources,
      confidence: plan.confidence,
      grounded: false,
    });
    return res.end();
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  let full = '';
  let tokens = null;
  let llmLatency = 0;
  // Abort generation (and stop token spend) when the client disconnects.
  const clientAbort = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) clientAbort.abort();
  });
  try {
    const r = await streamAnswer(plan, text, clean, (tok) => sse(res, 'token', { text: tok }), clientAbort.signal);
    // streamAnswer resolves with full text; tokens streamed incrementally above.
    full = r.text;
    llmLatency = r.latencyMs;
  } catch (err) {
    logger.error('rag', 'LLM stream failed', err);
    // Fall back to single-shot inside the stream lifetime.
    try {
      const one = await answerTurn(plan, text, clean);
      full = one.text;
      tokens = one.tokens;
      llmLatency = one.latencyMs;
      sse(res, 'token', { text: full });
    } catch (err2) {
      logger.error('rag', 'LLM fallback failed', err2);
      sse(res, 'error', { message: 'Assistant is temporarily unavailable. Please try again shortly.' });
      return res.end();
    }
  }

  const sources = answerCitations(plan);
  const totalLatency = Date.now() - started;
  try {
    await saveTurn(convo.conversationId, {
      userText: text,
      answer: full,
      sources,
      confidence: plan.confidence,
      tokens,
      latencyMs: totalLatency,
      lowConfidence: plan.confidence < 0.8,
    });
  } catch (err) {
    logger.error('rag', 'Failed to persist chat turn', err);
  }
  sse(res, 'done', {
    conversationId: convo.conversationId,
    answer: full,
    sources,
    confidence: plan.confidence,
    grounded: true,
    latencyMs: totalLatency,
    llmLatencyMs: llmLatency,
  });
  return res.end();
}

export async function getChatHistory(req, res) {
  const { conversationId } = req.params;
  const convo = await getOrCreateConversation(conversationId, req);
  const messages = await getHistory(convo.conversationId);
  return res.json({ conversationId: convo.conversationId, messages });
}

export async function deleteChatHistory(req, res) {
  const { conversationId } = req.params;
  const convo = await getOrCreateConversation(conversationId, req);
  await clearConversation(convo.conversationId);
  return res.json({ success: true });
}

export default { chatStream, getChatHistory, deleteChatHistory };
