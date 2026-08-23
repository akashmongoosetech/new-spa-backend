import { Router } from 'express';
import faqController from '../controllers/faqController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', asyncHandler(faqController.listFaqs));

// Admin / Manager CRUD
router.post('/', protect, authorize('Super Admin', 'Admin', 'Manager'), asyncHandler(faqController.createFaq));
router.put('/:id', protect, authorize('Super Admin', 'Admin', 'Manager'), asyncHandler(faqController.updateFaq));
router.delete('/:id', protect, authorize('Super Admin', 'Admin', 'Manager'), asyncHandler(faqController.deleteFaq));

// Toggle publish/unpublish status
router.patch('/:id/toggle', protect, authorize('Super Admin', 'Admin', 'Manager'), asyncHandler(faqController.toggleFaqStatus));

export default router;