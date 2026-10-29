import { Router } from 'express';
import blogController from '../controllers/blogController.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { blogReadLimiter, blogSitemapLimiter } from '../config/rateLimiters.js';

const router = Router();

router.get('/posts', blogReadLimiter, asyncHandler(blogController.publicListPosts));
router.get('/featured', blogReadLimiter, asyncHandler(blogController.publicFeaturedPosts));
router.get('/categories', blogReadLimiter, asyncHandler(blogController.publicCategories));
router.get('/tags', blogReadLimiter, asyncHandler(blogController.publicTags));
router.get('/sitemap', blogSitemapLimiter, asyncHandler(blogController.publicSitemap));
router.get('/posts/:slug', blogReadLimiter, asyncHandler(blogController.publicGetPost));

export default router;
