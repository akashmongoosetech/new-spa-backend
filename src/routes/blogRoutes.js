import { Router } from 'express';
import blogController from '../controllers/blogController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';
import validateObjectId from '../middleware/validateObjectId.js';

const router = Router();

// Public endpoints (published + active only)
router.get('/public', asyncHandler(blogController.getPublicBlogs));
router.get('/featured', asyncHandler(blogController.getFeaturedBlogs));
router.get('/slug/:slug', asyncHandler(blogController.getBlogBySlug));

// Admin endpoints (with auth)
router.get('/', asyncHandler(blogController.listBlogs));
router.get('/:id', protect, authorize('Super Admin', 'Admin', 'Manager'), validateObjectId('id'), asyncHandler(blogController.getBlogById));
router.post('/', protect, authorize('Super Admin', 'Admin', 'Manager'), asyncHandler(blogController.createBlog));
router.put('/:id', protect, authorize('Super Admin', 'Admin', 'Manager'), validateObjectId('id'), asyncHandler(blogController.updateBlog));
router.delete('/:id', protect, authorize('Super Admin', 'Admin', 'Manager'), validateObjectId('id'), asyncHandler(blogController.deleteBlog));

// Toggle endpoints
router.patch('/:id/publish', protect, authorize('Super Admin', 'Admin', 'Manager'), validateObjectId('id'), asyncHandler(blogController.togglePublish));
router.patch('/:id/feature', protect, authorize('Super Admin', 'Admin', 'Manager'), validateObjectId('id'), asyncHandler(blogController.toggleFeature));
router.patch('/:id/status', protect, authorize('Super Admin', 'Admin', 'Manager'), validateObjectId('id'), asyncHandler(blogController.toggleStatus));

export default router;