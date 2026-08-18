import { Router } from 'express';
import couponController from '../controllers/couponController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';
import validateObjectId from '../middleware/validateObjectId.js';
import { couponLimiter } from '../config/rateLimiters.js';

const router = Router();

router.post('/validate', couponLimiter, asyncHandler(couponController.validateCoupon));
router.get('/', protect, authorize('Super Admin', 'Admin', 'Manager'), asyncHandler(couponController.listCoupons));
router.post('/', protect, authorize('Super Admin', 'Admin', 'Manager'), asyncHandler(couponController.createCoupon));
router.delete('/:id', protect, authorize('Super Admin', 'Admin', 'Manager'), validateObjectId('id'), asyncHandler(couponController.deleteCoupon));

export default router;