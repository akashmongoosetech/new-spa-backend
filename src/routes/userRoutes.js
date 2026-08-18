import { Router } from 'express';
import userController from '../controllers/userController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';
import validateObjectId from '../middleware/validateObjectId.js';

const router = Router();

router.use(protect);
router.use(authorize('Super Admin', 'Admin'));

router.get('/', asyncHandler(userController.listUsers));
router.post('/', asyncHandler(userController.createUser));
router.put('/:id', validateObjectId('id'), asyncHandler(userController.updateUser));
router.delete('/:id', validateObjectId('id'), asyncHandler(userController.deleteUser));

export default router;