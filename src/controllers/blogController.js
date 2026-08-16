import { v4 as uuidv4 } from 'uuid';
import { BlogModel } from '../models/BlogModel.js';
import { generateSlug } from '../utils/helpers.js';
import { sendError, sendSuccess, handleError } from '../utils/responseHandler.js';
import { createNotification } from '../services/notificationService.js';

export const getBlogs = (req, res) => {
  try {
    const blogs = BlogModel.getAll();
    return res.json(blogs);
  } catch (err) {
    return handleError(res, err);
  }
};

export const getBlogBySlug = (req, res) => {
  try {
    const blog = BlogModel.getBySlug(req.params.slug);
    if (!blog) return sendError(res, 'Blog post not found', 404);
    return res.json(blog);
  } catch (err) {
    return handleError(res, err);
  }
};

export const createBlog = (req, res) => {
  try {
    const { title, excerpt, content, category, author, imageUrl, tags } = req.body;
    if (!title || !content) return sendError(res, 'Title and content are required', 400);

    const id = `blog-${uuidv4().slice(0, 8)}`;
    const slug = generateSlug(title);

    const post = BlogModel.create({
      id, title, slug, excerpt, content, category, author, imageUrl, tags
    });

    createNotification('New Journal Article', `Published: ${title}`, 'info', `/blog/${slug}`);
    return res.status(201).json(post);
  } catch (err) {
    if (String(err?.message || '').includes('UNIQUE')) {
      return sendError(res, 'A blog post with this title already exists', 400);
    }
    return handleError(res, err);
  }
};

export const updateBlog = (req, res) => {
  try {
    const { id } = req.params;
    if (req.body.title) {
      req.body.slug = generateSlug(req.body.title);
    }
    const updated = BlogModel.update(id, req.body);
    return res.json(updated);
  } catch (err) {
    if (String(err?.message || '').includes('UNIQUE')) {
      return sendError(res, 'A blog post with this title already exists', 400);
    }
    return handleError(res, err);
  }
};

export const addBlogComment = (req, res) => {
  try {
    const { id } = req.params;
    const { name, author, email, comment, content } = req.body;
    const authorName = name || author;
    const commentContent = comment || content;

    if (!authorName || !commentContent) {
      return sendError(res, 'Author name and comment content are required', 400);
    }

    const commentId = `cmt-${uuidv4().slice(0, 8)}`;
    BlogModel.addComment(id, {
      id: commentId,
      author: authorName,
      email: email || 'guest@auraluxespa.in',
      content: commentContent
    });

    createNotification('New Article Comment', `${authorName} commented on article`, 'info');
    return sendSuccess(res, null, 'Comment added successfully');
  } catch (err) {
    return handleError(res, err);
  }
};

export const deleteBlog = (req, res) => {
  try {
    BlogModel.delete(req.params.id);
    return sendSuccess(res, null, 'Blog deleted successfully');
  } catch (err) {
    return handleError(res, err);
  }
};
