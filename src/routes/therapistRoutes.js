import { Router } from 'express';
import therapistController from '../controllers/therapistController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';
import validateObjectId from '../middleware/validateObjectId.js';

const router = Router();

router.get('/', asyncHandler(therapistController.listTherapists));
router.post('/', protect, authorize('Super Admin', 'Admin', 'Manager'), asyncHandler(therapistController.createTherapist));
router.put('/:id', protect, authorize('Super Admin', 'Admin', 'Manager'), validateObjectId('id'), asyncHandler(therapistController.updateTherapist));
router.delete('/:id', protect, authorize('Super Admin', 'Admin', 'Manager'), validateObjectId('id'), asyncHandler(therapistController.deleteTherapist));

export default router;