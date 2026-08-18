import { Router } from 'express';
import serviceController from '../controllers/serviceController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';
import validateObjectId from '../middleware/validateObjectId.js';

const router = Router();

router.get('/', asyncHandler(serviceController.listServices));
router.post('/', protect, authorize('Super Admin', 'Admin', 'Manager'), asyncHandler(serviceController.createService));
router.put('/:id', protect, authorize('Super Admin', 'Admin', 'Manager'), validateObjectId('id'), asyncHandler(serviceController.updateService));
router.delete('/:id', protect, authorize('Super Admin', 'Admin', 'Manager'), validateObjectId('id'), asyncHandler(serviceController.deleteService));

export default router;