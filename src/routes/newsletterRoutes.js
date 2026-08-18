import { Router } from 'express';
import newsletterController from '../controllers/newsletterController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';
import validateObjectId from '../middleware/validateObjectId.js';
import { newsletterLimiter } from '../config/rateLimiters.js';

const router = Router();

// Public
router.post('/', newsletterLimiter, asyncHandler(newsletterController.subscribe));

// Admin
router.use(protect);
router.use(authorize('Super Admin', 'Admin', 'Manager'));

router.get('/', asyncHandler(newsletterController.listSubscribers));
router.delete('/:id', validateObjectId('id'), asyncHandler(newsletterController.deleteSubscriber));

export default router;