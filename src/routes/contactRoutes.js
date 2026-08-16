import { Router } from 'express';
import {
  getContacts, createContact, replyContact, updateContactStatus,
  deleteContact, bulkDeleteContacts
} from '../controllers/contactController.js';
import { authenticateJwt } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

const router = Router();

const staffOnly = [authenticateJwt, authorizeRoles('Super Admin', 'Admin', 'Manager', 'Receptionist')];
const adminOnly = [authenticateJwt, authorizeRoles('Super Admin', 'Admin')];

router.get('/', staffOnly, getContacts);
router.post('/', createContact);
router.put('/:id', staffOnly, updateContactStatus);
router.post('/:id/reply', staffOnly, replyContact);
router.post('/bulk-delete', adminOnly, bulkDeleteContacts);
router.delete('/:id', adminOnly, deleteContact);

export default router;
