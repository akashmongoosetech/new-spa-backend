import { chat } from '../services/aiService.js';
import { HttpError } from '../utils/api.js';

export async function chatHandler(req, res) {
  const { message, history } = req.body || {};
  const text = String(message || '').trim().slice(0, 1000);
  if (!text) {
    throw new HttpError(400, 'A message is required');
  }
  if (history !== undefined && !Array.isArray(history)) {
    throw new HttpError(400, 'Invalid history format');
  }
  const cleanHistory = Array.isArray(history) ? history.slice(-6).map((h) => {
    if (!h || typeof h !== 'object') return null;
    const sender = h.sender || h.role;
    const content = String(h.content || h.text || '').slice(0, 1000);
    if (!content.trim()) return null;
    return { sender: sender === 'assistant' || sender === 'model' ? 'assistant' : 'user', text: content };
  }).filter(Boolean) : [];

  const result = await chat(text, cleanHistory);
  return res.json({ reply: result.reply, source: result.source });
}

export default { chatHandler };