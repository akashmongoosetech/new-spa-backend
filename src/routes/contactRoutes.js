import { Router } from 'express';
import contactController from '../controllers/contactController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';
import validateObjectId from '../middleware/validateObjectId.js';
import { contactLimiter } from '../config/rateLimiters.js';

const router = Router();

// Public
router.post('/', contactLimiter, asyncHandler(contactController.createContact));

// Admin (all staff roles can manage messages)
router.use(protect);
router.use(authorize('Super Admin', 'Admin', 'Manager', 'Receptionist'));

router.get('/', asyncHandler(contactController.listContacts));
router.put('/:id', validateObjectId('id'), asyncHandler(contactController.updateContact));
router.post('/:id/reply', validateObjectId('id'), asyncHandler(contactController.replyContact));
router.delete('/:id', validateObjectId('id'), asyncHandler(contactController.deleteContact));
router.post('/bulk-delete', asyncHandler(contactController.bulkDeleteContacts));

export default router;