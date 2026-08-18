import { Router } from 'express';
import galleryController from '../controllers/galleryController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';
import validateObjectId from '../middleware/validateObjectId.js';

const router = Router();

router.get('/', asyncHandler(galleryController.listGallery));
router.post('/', protect, authorize('Super Admin', 'Admin'), asyncHandler(galleryController.createGalleryItem));
router.delete('/:id', protect, authorize('Super Admin', 'Admin'), validateObjectId('id'), asyncHandler(galleryController.deleteGalleryItem));

export default router;