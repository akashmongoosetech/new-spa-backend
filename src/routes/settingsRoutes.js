import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { authenticateJwt } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

const router = Router();
const adminOnly = [authenticateJwt, authorizeRoles('Super Admin', 'Admin')];

router.get('/', getSettings);
router.post('/', adminOnly, updateSettings);
router.put('/', adminOnly, updateSettings);

export default router;
