import { Router } from 'express';
import bookingController from '../controllers/bookingController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';
import validateObjectId from '../middleware/validateObjectId.js';
import { bookingLimiter, lookupLimiter } from '../config/rateLimiters.js';

const router = Router();

// Public (self-service; ownership proven via bookingNumber + email pair)
router.post('/', bookingLimiter, asyncHandler(bookingController.createBooking));
router.get('/lookup', lookupLimiter, asyncHandler(bookingController.lookupBooking));
router.post('/public-cancel', bookingLimiter, asyncHandler(bookingController.publicCancelBooking));
router.post('/public-reschedule', bookingLimiter, asyncHandler(bookingController.publicRescheduleBooking));

// Admin (all staff roles can manage bookings)
router.use(protect);
router.use(authorize('Super Admin', 'Admin', 'Manager', 'Receptionist'));

router.get('/', asyncHandler(bookingController.listBookings));
router.put('/:id', validateObjectId('id'), asyncHandler(bookingController.updateBooking));
router.delete('/:id', validateObjectId('id'), asyncHandler(bookingController.deleteBooking));
router.post('/:id/send-reminder', validateObjectId('id'), asyncHandler(bookingController.sendReminder));
router.post('/trigger-reminders', asyncHandler(bookingController.triggerReminders));

export default router;