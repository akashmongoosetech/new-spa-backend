import { Router } from 'express';
import blogController from '../controllers/blogController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, optionalProtect, authorize } from '../middleware/auth.js';
import validateObjectId from '../middleware/validateObjectId.js';
import { blogReadLimiter, blogWriteLimiter } from '../config/rateLimiters.js';

const router = Router();
const WRITERS = ['Super Admin', 'Admin', 'Manager'];

// Backward-compatible public endpoints. Their array response shape is kept
// intentionally for the currently deployed frontend and static generator.
router.get('/public', blogReadLimiter, asyncHandler(blogController.getPublicBlogs));
router.get('/featured', blogReadLimiter, asyncHandler(blogController.getFeaturedBlogs));
router.get('/slug/:slug', blogReadLimiter, asyncHandler(blogController.getBlogBySlug));

// Legacy list: public published posts, or all drafts for an authenticated admin.
router.get('/', blogReadLimiter, optionalProtect, asyncHandler(blogController.listBlogs));

// Legacy admin aliases.
router.get('/:id', protect, authorize(...WRITERS), validateObjectId('id'), asyncHandler(blogController.getBlogById));
router.post('/', protect, authorize(...WRITERS), blogWriteLimiter, asyncHandler(blogController.createBlog));
router.put('/:id', protect, authorize(...WRITERS), blogWriteLimiter, validateObjectId('id'), asyncHandler(blogController.updateBlog));
router.delete('/:id', protect, authorize(...WRITERS), blogWriteLimiter, validateObjectId('id'), asyncHandler(blogController.deleteBlog));
router.patch('/:id/publish', protect, authorize(...WRITERS), blogWriteLimiter, validateObjectId('id'), asyncHandler(blogController.togglePublish));
router.patch('/:id/feature', protect, authorize(...WRITERS), blogWriteLimiter, validateObjectId('id'), asyncHandler(blogController.toggleFeature));
router.patch('/:id/status', protect, authorize(...WRITERS), blogWriteLimiter, validateObjectId('id'), asyncHandler(blogController.toggleStatus));

export default router;
