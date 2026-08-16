import { processAiChat } from '../services/aiService.js';
import { sendError, handleError } from '../utils/responseHandler.js';

export const handleAiChat = async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      return sendError(res, 'Message is required', 400);
    }

    const result = await processAiChat(message, history || []);
    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
};
