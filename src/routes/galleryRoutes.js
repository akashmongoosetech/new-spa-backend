import { Router } from 'express';
import { getGallery, createGalleryItem, deleteGalleryItem } from '../controllers/galleryController.js';
import { authenticateJwt } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

const router = Router();
const adminOnly = [authenticateJwt, authorizeRoles('Super Admin', 'Admin')];

router.get('/', getGallery);
router.post('/', adminOnly, createGalleryItem);
router.delete('/:id', adminOnly, deleteGalleryItem);

export default router;
