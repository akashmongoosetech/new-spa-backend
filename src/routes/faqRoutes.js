import { Router } from 'express';
import faqController from '../controllers/faqController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';
import validateObjectId from '../middleware/validateObjectId.js';

const router = Router();

router.get('/', asyncHandler(faqController.listFaqs));
router.post('/', protect, authorize('Super Admin', 'Admin'), asyncHandler(faqController.createFaq));
router.put('/:id', protect, authorize('Super Admin', 'Admin'), validateObjectId('id'), asyncHandler(faqController.updateFaq));
router.delete('/:id', protect, authorize('Super Admin', 'Admin'), validateObjectId('id'), asyncHandler(faqController.deleteFaq));

export default router;