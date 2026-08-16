import { Router } from 'express';
import { getTestimonials, createTestimonial, deleteTestimonial } from '../controllers/testimonialController.js';
import { authenticateJwt } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

const router = Router();
const adminOnly = [authenticateJwt, authorizeRoles('Super Admin', 'Admin')];

router.get('/', getTestimonials);
router.post('/', adminOnly, createTestimonial);
router.delete('/:id', adminOnly, deleteTestimonial);

export default router;
