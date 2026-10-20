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
  if (res.writableEnded || res.destroyed) return;
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    // Flush per event when the framework/host supports it (compression/proxy).
    if (typeof res.flush === 'function') res.flush();
  } catch {
    // The socket can disappear between the guards and the write; the request
    // close handler will abort the generation.
  }
}

function startSse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  // Idle proxies (nginx/Cloudflare) drop silent connections; send a comment
  // every 15s until the stream is finished.
  const heartbeat = setInterval(() => {
    if (res.writableEnded || res.destroyed) return;
    try {
      res.write(': keep-alive\n\n');
    } catch {
      /* socket closed; the request handler will finish */
    }
  }, 15000);
  if (typeof heartbeat.unref === 'function') heartbeat.unref();
  const stop = () => clearInterval(heartbeat);
  res.once('close', stop);
  res.once('finish', stop);
  return stop;
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
    const stopSse = startSse(res);
    sse(res, 'done', {
      conversationId: convo.conversationId,
      answer,
      sources,
      confidence: plan.confidence,
      grounded: false,
    });
    stopSse();
    return res.end();
  }

  const stopSse = startSse(res);

  let full = '';
  let streamed = '';
  let tokens = null;
  let llmLatency = 0;
  // Abort generation (and stop token spend) when the client disconnects.
  const clientAbort = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) clientAbort.abort();
  });
  try {
    const r = await streamAnswer(
      plan,
      text,
      clean,
      (tok) => {
        streamed += tok;
        sse(res, 'token', { text: tok });
      },
      clientAbort.signal
    );
    // streamAnswer resolves with full text; tokens streamed incrementally above.
    full = r.text;
    llmLatency = r.latencyMs;
  } catch (err) {
    if (clientAbort.signal.aborted) {
      stopSse();
      return res.end();
    }
    logger.error('rag', 'LLM stream failed', err);
    // Fall back to single-shot inside the stream lifetime. Only send the
    // suffix that was not already streamed, so the client never sees a
    // duplicated answer.
    try {
      const one = await answerTurn(plan, text, clean);
      full = one.text;
      tokens = one.tokens;
      llmLatency = one.latencyMs;
      const remaining = streamed && full.startsWith(streamed) ? full.slice(streamed.length) : streamed ? '' : full;
      if (remaining) sse(res, 'token', { text: remaining });
    } catch (err2) {
      logger.error('rag', 'LLM fallback failed', err2);
      sse(res, 'error', { message: 'Assistant is temporarily unavailable. Please try again shortly.' });
      stopSse();
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
  stopSse();
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
