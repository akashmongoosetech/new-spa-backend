import crypto from 'crypto';
import Conversation from '../models/Conversation.js';
import ChatMessage from '../models/ChatMessage.js';

const HISTORY_WINDOW = 12; // stored; only last 6 go to the LLM

export function newConversationId() {
  return crypto.randomUUID();
}

export function ipHash(req) {
  const raw = req.ip || req.headers['x-forwarded-for'] || '';
  return crypto.createHash('sha256').update(String(raw).split(',')[0].trim()).digest('hex');
}

export async function getOrCreateConversation(conversationId, req) {
  let id = String(conversationId || '').trim();
  if (!/^[0-9a-f-]{8,64}$/i.test(id)) id = newConversationId();
  let convo = await Conversation.findOne({ conversationId: id });
  if (!convo) {
    convo = await Conversation.create({ conversationId: id, ipHash: ipHash(req) });
  }
  return convo;
}

export async function getHistory(conversationId, limit = HISTORY_WINDOW) {
  const msgs = await ChatMessage.find({ conversationId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return msgs.reverse().map((m) => ({
    role: m.role,
    text: m.text,
    sources: m.sources || [],
    createdAt: m.createdAt,
  }));
}

export async function saveTurn(conversationId, { userText, answer, sources, confidence, tokens, latencyMs, lowConfidence }) {
  await ChatMessage.create({
    conversationId,
    role: 'user',
    text: String(userText).slice(0, 2000),
  });
  await ChatMessage.create({
    conversationId,
    role: 'assistant',
    text: String(answer).slice(0, 4000),
    sources: (sources || []).slice(0, 4),
    confidence: confidence ?? null,
    tokens: tokens ?? null,
    latencyMs: latencyMs ?? null,
    lowConfidence: !!lowConfidence,
  });
  await Conversation.updateOne({ conversationId }, { $inc: { messageCount: 2 }, $set: { updatedAt: new Date() } });
}

export async function clearConversation(conversationId) {
  await ChatMessage.deleteMany({ conversationId });
  await Conversation.deleteOne({ conversationId });
}

/** Admin review queue: recent low-confidence assistant answers. */
export async function lowConfidenceQueue(limit = 50) {
  const msgs = await ChatMessage.find({ role: 'assistant', lowConfidence: true })
    .sort({ createdAt: -1 })
    .limit(Math.min(200, Math.max(1, limit)))
    .lean();
  const out = [];
  for (const m of msgs) {
    const q = await ChatMessage.findOne({ conversationId: m.conversationId, role: 'user', createdAt: { $lt: m.createdAt } })
      .sort({ createdAt: -1 })
      .select('text createdAt')
      .lean();
    out.push({
      id: m._id.toString(),
      conversationId: m.conversationId,
      question: q ? q.text : '',
      answer: m.text,
      confidence: m.confidence,
      createdAt: m.createdAt,
    });
  }
  return out;
}

export default { newConversationId, getOrCreateConversation, getHistory, saveTurn, clearConversation, lowConfidenceQueue };
