import { Router } from 'express';
import blogController from '../controllers/blogController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';
import validateObjectId from '../middleware/validateObjectId.js';

const router = Router();

// Public (published only unless admin requests all)
router.get('/', asyncHandler(blogController.listBlogs));

// Admin
router.post('/', protect, authorize('Super Admin', 'Admin'), asyncHandler(blogController.createBlog));
router.put('/:id', protect, authorize('Super Admin', 'Admin'), validateObjectId('id'), asyncHandler(blogController.updateBlog));
router.delete('/:id', protect, authorize('Super Admin', 'Admin'), validateObjectId('id'), asyncHandler(blogController.deleteBlog));

export default router;