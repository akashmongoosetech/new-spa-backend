import { Router } from 'express';
import testimonialController from '../controllers/testimonialController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, optionalProtect, authorize } from '../middleware/auth.js';
import validateObjectId from '../middleware/validateObjectId.js';

const router = Router();

// Public (approved only unless admin requests all with role gate in controller)
router.get('/', optionalProtect, asyncHandler(testimonialController.listTestimonials));

// Admin
router.post('/', protect, authorize('Super Admin', 'Admin'), asyncHandler(testimonialController.createTestimonial));
router.put('/:id', protect, authorize('Super Admin', 'Admin'), validateObjectId('id'), asyncHandler(testimonialController.updateTestimonial));
router.delete('/:id', protect, authorize('Super Admin', 'Admin'), validateObjectId('id'), asyncHandler(testimonialController.deleteTestimonial));

export default router;