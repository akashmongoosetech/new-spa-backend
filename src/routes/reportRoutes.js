import { Router } from 'express';
import reportController from '../controllers/reportController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';
import { reportLimiter } from '../config/rateLimiters.js';

const router = Router();

router.get('/export', reportLimiter, protect, authorize('Super Admin', 'Admin', 'Manager'), asyncHandler(reportController.exportReport));

export default router;