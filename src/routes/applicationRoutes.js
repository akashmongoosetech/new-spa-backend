import { Router } from 'express';
import applicationController from '../controllers/applicationController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';
import validateObjectId from '../middleware/validateObjectId.js';

const router = Router();

// Only a Super Admin can review staff applications.
router.use(protect);
router.use(authorize('Super Admin'));

router.get('/', asyncHandler(applicationController.listApplications));
router.post('/:id/approve', validateObjectId('id'), asyncHandler(applicationController.approveApplication));
router.post('/:id/reject', validateObjectId('id'), asyncHandler(applicationController.rejectApplication));
router.delete('/:id', validateObjectId('id'), asyncHandler(applicationController.deleteApplication));

export default router;