import { Router } from 'express';
import authController from '../controllers/authController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect } from '../middleware/auth.js';
import { authLimiter, passwordResetLimiter } from '../config/rateLimiters.js';

const router = Router();

router.post('/login', authLimiter, asyncHandler(authController.login));
router.post('/signup', authLimiter, asyncHandler(authController.signup));
router.post('/forgot-password', passwordResetLimiter, asyncHandler(authController.forgotPassword));
router.post('/reset-password', passwordResetLimiter, asyncHandler(authController.resetPassword));
router.post('/change-password', protect, asyncHandler(authController.changePassword));
router.get('/me', protect, asyncHandler(authController.getProfile));

export default router;