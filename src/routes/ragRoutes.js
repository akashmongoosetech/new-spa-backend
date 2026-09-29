import { Router } from 'express';
import ragController from '../controllers/ragController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';
import { ragAdminLimiter } from '../config/rateLimiters.js';

const router = Router();

router.use(ragAdminLimiter);
router.use(protect);
router.use(authorize('Super Admin', 'Admin', 'Manager'));

router.get('/sources', asyncHandler(ragController.getSources));
router.post('/reindex', asyncHandler(ragController.reindex));
router.delete('/sources/:source', asyncHandler(ragController.deleteSource));
router.post('/test', asyncHandler(ragController.testRetrieval));
router.get('/review', asyncHandler(ragController.reviewQueue));
router.get('/usage', asyncHandler(ragController.usageStats));

export default router;
