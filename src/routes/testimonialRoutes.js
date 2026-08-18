import { Router } from 'express';
import testimonialController from '../controllers/testimonialController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';
import validateObjectId from '../middleware/validateObjectId.js';

const router = Router();

// Public (approved only unless admin requests all)
router.get('/', asyncHandler(testimonialController.listTestimonials));

// Admin
router.post('/', protect, authorize('Super Admin', 'Admin'), asyncHandler(testimonialController.createTestimonial));
router.delete('/:id', protect, authorize('Super Admin', 'Admin'), validateObjectId('id'), asyncHandler(testimonialController.deleteTestimonial));

export default router;