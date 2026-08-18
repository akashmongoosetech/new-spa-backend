import { Router } from 'express';
import scheduleController from '../controllers/scheduleController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', protect, authorize('Super Admin', 'Admin', 'Manager', 'Receptionist'), asyncHandler(scheduleController.getSchedule));
router.put('/', protect, authorize('Super Admin', 'Admin', 'Manager', 'Receptionist'), asyncHandler(scheduleController.updateSchedule));

export default router;