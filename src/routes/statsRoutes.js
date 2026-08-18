import { Router } from 'express';
import statsController from '../controllers/statsController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', protect, authorize('Super Admin', 'Admin', 'Manager', 'Receptionist'), asyncHandler(statsController.adminStats));

export default router;