import { Router } from 'express';
import blogController from '../controllers/blogController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { protect, authorize } from '../middleware/auth.js';
import validateObjectId from '../middleware/validateObjectId.js';
import { blogWriteLimiter } from '../config/rateLimiters.js';
import { blogStatusSchema, blogFeaturedSchema } from '../utils/blogValidation.js';
import { HttpError } from '../utils/api.js';

const router = Router();
const WRITERS = ['Super Admin', 'Admin', 'Manager'];

router.use(protect, authorize(...WRITERS));

router.get('/', asyncHandler(blogController.adminListBlogs));

// Categories are declared before /:id so "categories" is never treated as an id.
router.get('/categories', asyncHandler(blogController.adminListCategories));
router.post('/categories', blogWriteLimiter, asyncHandler(blogController.adminCreateCategory));
router.put('/categories/:id', blogWriteLimiter, validateObjectId('id'), asyncHandler(blogController.adminUpdateCategory));
router.delete('/categories/:id', blogWriteLimiter, validateObjectId('id'), asyncHandler(blogController.adminDeleteCategory));

router.get('/:id', validateObjectId('id'), asyncHandler(blogController.adminGetBlog));
router.post('/', blogWriteLimiter, asyncHandler(blogController.adminCreateBlog));
router.put('/:id', blogWriteLimiter, validateObjectId('id'), asyncHandler(blogController.adminUpdateBlog));
router.delete('/:id', blogWriteLimiter, validateObjectId('id'), asyncHandler(blogController.adminDeleteBlog));

router.patch(
  '/:id/status',
  blogWriteLimiter,
  validateObjectId('id'),
  (req, _res, next) => {
    const parsed = blogStatusSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return next(new HttpError(400, 'Status must be draft, published or unpublished.'));
    }
    req.body = parsed.data;
    return next();
  },
  asyncHandler(blogController.adminSetStatus)
);

router.patch(
  '/:id/featured',
  blogWriteLimiter,
  validateObjectId('id'),
  (req, _res, next) => {
    const parsed = blogFeaturedSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return next(new HttpError(400, 'isFeatured must be true or false.'));
    }
    req.body = parsed.data;
    return next();
  },
  asyncHandler(blogController.adminSetFeatured)
);

export default router;
