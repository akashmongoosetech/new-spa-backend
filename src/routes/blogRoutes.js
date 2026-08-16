import { Router } from 'express';
import { getBlogs, getBlogBySlug, createBlog, updateBlog, deleteBlog, addBlogComment } from '../controllers/blogController.js';
import { authenticateJwt } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

const router = Router();
const adminOnly = [authenticateJwt, authorizeRoles('Super Admin', 'Admin')];

router.get('/', getBlogs);
router.get('/:slug', getBlogBySlug);
router.post('/', adminOnly, createBlog);
router.put('/:id', adminOnly, updateBlog);
router.delete('/:id', adminOnly, deleteBlog);
router.post('/:id/comments', adminOnly, addBlogComment);

export default router;
