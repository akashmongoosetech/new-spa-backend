import { Router } from 'express';
import { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification } from '../controllers/notificationController.js';
import { authenticateJwt } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

const router = Router();
const staffOnly = [authenticateJwt, authorizeRoles('Super Admin', 'Admin', 'Manager', 'Receptionist')];

router.get('/', staffOnly, getNotifications);
router.post('/mark-all-read', staffOnly, markAllNotificationsRead);
router.put('/:id/read', staffOnly, markNotificationRead);
router.delete('/:id', staffOnly, deleteNotification);

export default router;
