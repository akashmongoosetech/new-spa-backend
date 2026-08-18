import { Router } from 'express';
import auditController from '../controllers/auditController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);
router.use(authorize('Super Admin', 'Admin'));

router.get('/audit-logs', asyncHandler(auditController.listAuditLogs));
router.get('/login-activities', asyncHandler(auditController.listLoginActivities));

export default router;