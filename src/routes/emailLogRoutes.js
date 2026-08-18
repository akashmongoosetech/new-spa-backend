import { Router } from 'express';
import emailLogController from '../controllers/emailLogController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', protect, authorize('Super Admin', 'Admin'), asyncHandler(emailLogController.listEmailLogs));

export default router;