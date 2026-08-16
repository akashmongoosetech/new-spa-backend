import { Router } from 'express';
import { getCoupons, validateCoupon, createCoupon, deleteCoupon } from '../controllers/couponController.js';
import { authenticateJwt } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

const router = Router();
const adminOnly = [authenticateJwt, authorizeRoles('Super Admin', 'Admin')];

router.get('/', adminOnly, getCoupons);
router.post('/validate', validateCoupon);
router.post('/', adminOnly, createCoupon);
router.delete('/:id', adminOnly, deleteCoupon);

export default router;
