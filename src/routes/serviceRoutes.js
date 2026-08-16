import { Router } from 'express';
import { getServices, getServiceById, createService, updateService, deleteService } from '../controllers/serviceController.js';
import { authenticateJwt } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

const router = Router();
const adminOnly = [authenticateJwt, authorizeRoles('Super Admin', 'Admin')];

router.get('/', getServices);
router.get('/:id', getServiceById);
router.post('/', adminOnly, createService);
router.put('/:id', adminOnly, updateService);
router.delete('/:id', adminOnly, deleteService);

export default router;
