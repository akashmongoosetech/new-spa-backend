import { Router } from 'express';
import { adminLogin, adminSignup, getCurrentUser, forgotPassword, resetPassword, changePassword } from '../controllers/authController.js';
import { authenticateJwt } from '../middleware/authMiddleware.js';

const router = Router();
router.post('/login', adminLogin);
router.post('/signup', adminSignup);
router.get('/me', authenticateJwt, getCurrentUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', authenticateJwt, changePassword);

export default router;
