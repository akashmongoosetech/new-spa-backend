import { Router } from 'express';
import aiController from '../controllers/aiController.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = Router();

router.post('/chat', asyncHandler(aiController.chatHandler));

export default router;