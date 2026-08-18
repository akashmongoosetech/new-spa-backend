import { Router } from 'express';
import settingController from '../controllers/settingController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

// Public (frontend reads settings on every page load)
router.get('/', asyncHandler(settingController.getSettings));
router.put('/', protect, authorize('Super Admin', 'Admin'), asyncHandler(settingController.updateSettings));

export default router;