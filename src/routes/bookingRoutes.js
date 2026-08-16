import { Router } from 'express';
import {
  getBookings, getBookingById, createBooking, updateBookingStatus, lookupBooking,
  deleteBooking, sendReminderEmail, triggerAutomatedReminders
} from '../controllers/bookingController.js';
import { authenticateJwt } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

const router = Router();

const staffOnly = [authenticateJwt, authorizeRoles('Super Admin', 'Admin', 'Manager', 'Receptionist')];
const adminOnly = [authenticateJwt, authorizeRoles('Super Admin', 'Admin')];

router.get('/', staffOnly, getBookings);
router.get('/lookup', lookupBooking); // public: self-service reservation lookup
router.get('/:id', staffOnly, getBookingById);
router.post('/', createBooking);
router.put('/:id', updateBookingStatus); // controller checks staff auth OR booking-number secret
router.delete('/:id', adminOnly, deleteBooking);
router.post('/:id/send-reminder', staffOnly, sendReminderEmail);
router.post('/trigger-reminders', staffOnly, triggerAutomatedReminders);

export default router;
