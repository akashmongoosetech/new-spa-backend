import { Router } from 'express';
import notificationController from '../controllers/notificationController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';
import validateObjectId from '../middleware/validateObjectId.js';

const router = Router();

router.use(protect);
router.use(authorize('Super Admin', 'Admin', 'Manager', 'Receptionist'));

router.get('/', asyncHandler(notificationController.getNotifications));
router.put('/:id/read', validateObjectId('id'), asyncHandler(notificationController.markNotificationRead));
router.post('/mark-all-read', asyncHandler(notificationController.markAllNotificationsRead));
router.delete('/:id', validateObjectId('id'), asyncHandler(notificationController.deleteNotificationItem));

export default router;