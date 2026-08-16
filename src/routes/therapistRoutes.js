import { Router } from 'express';
import { getTherapists, getTherapistById, createTherapist, updateTherapist, deleteTherapist } from '../controllers/therapistController.js';
import { authenticateJwt } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

const router = Router();
const adminOnly = [authenticateJwt, authorizeRoles('Super Admin', 'Admin')];

router.get('/', getTherapists);
router.get('/:id', getTherapistById);
router.post('/', adminOnly, createTherapist);
router.put('/:id', adminOnly, updateTherapist);
router.delete('/:id', adminOnly, deleteTherapist);

export default router;
