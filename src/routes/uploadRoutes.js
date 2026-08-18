import { Router } from 'express';
import uploadController from '../controllers/uploadController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { uploadLimiter } from '../config/rateLimiters.js';

const router = Router();

router.post('/', protect, authorize('Super Admin', 'Admin'), uploadLimiter, upload.single('file'), asyncHandler(uploadController.uploadFile));

export default router;