import { Router } from 'express';
import { getAdminStats, getScheduleConfig, updateScheduleConfig, exportReports } from '../controllers/adminController.js';
import { adminLogin, adminSignup, forgotPassword, resetPassword, changePassword } from '../controllers/authController.js';
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/userController.js';
import { getAuditLogs, getLoginActivities } from '../controllers/auditController.js';
import { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification } from '../controllers/notificationController.js';
import { authenticateJwt } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

const router = Router();

const adminOnly = [authenticateJwt, authorizeRoles('Super Admin', 'Admin')];
const staffOnly = [authenticateJwt, authorizeRoles('Super Admin', 'Admin', 'Manager', 'Receptionist')];

router.get('/stats', staffOnly, getAdminStats);
router.get('/schedule', staffOnly, getScheduleConfig);
router.put('/schedule', staffOnly, updateScheduleConfig);
router.get('/reports/export', staffOnly, exportReports);

// Auth aliases (login/signup/forgot/reset stay public)
router.post('/login', adminLogin);
router.post('/signup', adminSignup);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', authenticateJwt, changePassword);

router.get('/users', adminOnly, getUsers);
router.post('/users', adminOnly, createUser);
router.put('/users/:id', adminOnly, updateUser);
router.delete('/users/:id', adminOnly, deleteUser);

router.get('/audit-logs', adminOnly, getAuditLogs);
router.get('/login-activities', adminOnly, getLoginActivities);

router.get('/notifications', staffOnly, getNotifications);
router.post('/notifications/mark-all-read', staffOnly, markAllNotificationsRead);
router.put('/notifications/:id/read', staffOnly, markNotificationRead);
router.delete('/notifications/:id', staffOnly, deleteNotification);

export default router;
