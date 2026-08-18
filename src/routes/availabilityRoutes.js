import { Router } from 'express';
import availabilityController from '../controllers/availabilityController.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(availabilityController.getAvailability));

export default router;