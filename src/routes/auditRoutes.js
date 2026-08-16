import { Router } from 'express';
import { getAuditLogs, getLoginActivities, getEmailLogs } from '../controllers/auditController.js';
import { authenticateJwt } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

const router = Router();
const adminOnly = [authenticateJwt, authorizeRoles('Super Admin', 'Admin')];

router.get('/logs', adminOnly, getAuditLogs);
router.get('/activities', adminOnly, getLoginActivities);
router.get('/emails', adminOnly, getEmailLogs);
export default router;
