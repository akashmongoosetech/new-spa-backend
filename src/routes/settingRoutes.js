import { Router } from 'express';
import settingController from '../controllers/settingController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

// Public safe subset (frontend reads on every page load) + protected full view
router.get('/', asyncHandler(settingController.getPublicSettings));
router.get('/full', protect, authorize('Super Admin', 'Admin'), asyncHandler(settingController.getSettings));
router.put('/', protect, authorize('Super Admin', 'Admin'), asyncHandler(settingController.updateSettings));

export default router;