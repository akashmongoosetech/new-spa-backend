import { chat } from '../services/aiService.js';
import { HttpError } from '../utils/api.js';

export async function chatHandler(req, res) {
  const { message, history } = req.body || {};
  if (!message || !String(message).trim()) {
    throw new HttpError(400, 'A message is required');
  }

  const result = await chat(String(message).trim(), history);
  return res.json({ reply: result.reply });
}

export default { chatHandler };