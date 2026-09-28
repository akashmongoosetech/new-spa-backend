import { Router } from 'express';
import availabilityController from '../controllers/availabilityController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { availabilityLimiter } from '../config/rateLimiters.js';

const router = Router();

router.get('/', availabilityLimiter, asyncHandler(availabilityController.getAvailability));

export default router;