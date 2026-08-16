import { Router } from 'express';
import { getSubscribers, subscribeNewsletter, deleteSubscriber } from '../controllers/newsletterController.js';
import { authenticateJwt } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

const router = Router();
const staffOnly = [authenticateJwt, authorizeRoles('Super Admin', 'Admin', 'Manager')];

router.get('/', staffOnly, getSubscribers);
router.post('/', subscribeNewsletter);
router.delete('/:id', staffOnly, deleteSubscriber);

export default router;
