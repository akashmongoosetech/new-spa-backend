import { Router } from 'express';
import aiController from '../controllers/aiController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { aiLimiter } from '../config/rateLimiters.js';

const router = Router();

router.post('/chat', aiLimiter, asyncHandler(aiController.chatHandler));

export default router;