import { Router } from 'express';
import chatController from '../controllers/chatController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { chatLimiter, lookupLimiter } from '../config/rateLimiters.js';

const router = Router();

// Grounded RAG chat over SSE. Public; possession-based history (uuid).
router.post('/chat', chatLimiter, asyncHandler(chatController.chatStream));
router.get('/history/:conversationId', lookupLimiter, asyncHandler(chatController.getChatHistory));
router.delete('/history/:conversationId', lookupLimiter, asyncHandler(chatController.deleteChatHistory));

export default router;
