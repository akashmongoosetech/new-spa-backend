import { Router } from 'express';
import { handleAiChat } from '../controllers/aiController.js';

const router = Router();
router.post('/chat', handleAiChat);
export default router;
