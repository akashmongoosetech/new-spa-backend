import BlogPost from '../models/Blog.js';
import { uniqueSlug } from '../utils/slugify.js';
import { serializeBlogPost } from '../utils/serializers.js';
import { HttpError } from '../utils/api.js';
import { logAudit } from '../services/auditService.js';
import { sanitizeHtml, calculateReadTime } from '../utils/sanitize.js';
import { generateExcerpt, getExcerptLength } from '../utils/htmlTruncate.js';

function normalizeBody(b) {
  const out = {};
  if (b.title !== undefined) out.title = b.title;
  if (b.category !== undefined) out.category = b.category;
  if (b.author !== undefined) out.author = b.author;
  if (b.therapistName !== undefined) out.therapistName = b.therapistName;
  if (b.therapistAvatarUrl !== undefined) out.therapistAvatarUrl = b.therapistAvatarUrl;
  if (b.date !== undefined) out.date = b.date ? new Date(b.date) : undefined;
  if (b.read_time !== undefined) out.readTime = Number(b.read_time) || null;
  if (b.readTime !== undefined) out.readTime = Number(b.readTime) || null;
  if (b.excerpt !== undefined) out.excerpt = b.excerpt;
  if (b.summary !== undefined) out.summary = b.summary;
  if (b.content !== undefined) out.content = sanitizeHtml(b.content);
  if (b.image_url !== undefined) out.imageUrl = b.image_url;
  if (b.imageUrl !== undefined) out.imageUrl = b.imageUrl;
  if (b.cover_image !== undefined) out.coverImage = b.cover_image;
  if (b.coverImage !== undefined) out.coverImage = b.coverImage;
  if (b.tags !== undefined) out.tags = Array.isArray(b.tags) ? b.tags : [];
  if (b.published !== undefined) out.published = !(b.published === false || b.published === 0 || b.published === '0');
  if (b.status !== undefined) out.status = b.status;
  if (b.featureOnHomePage !== undefined) out.featureOnHomePage = b.featureOnHomePage === true || b.featureOnHomePage === 1 || b.featureOnHomePage === '1';
  if (b.seo !== undefined) {
    out.seo = {
      metaTitle: b.seo.metaTitle || '',
      metaDescription: b.seo.metaDescription || '',
      keywords: Array.isArray(b.seo.keywords) ? b.seo.keywords : [],
    };
  }
  return out;
}

export async function listBlogs(req, res) {
  const query = req.query.all === '1' ? {} : { published: true, status: 'active' };
  const posts = await BlogPost.find(query).sort({ createdAt: -1 }).lean();
  return res.json(posts.map(serializeBlogPost));
}

export async function getPublicBlogs(req, res) {
  const query = { published: true, status: 'active' };
  const posts = await BlogPost.find(query).sort({ createdAt: -1 }).lean();
  return res.json(posts.map(serializeBlogPost));
}

export async function getFeaturedBlogs(req, res) {
  const query = { published: true, status: 'active', featureOnHomePage: true };
  const posts = await BlogPost.find(query).sort({ createdAt: -1 }).limit(6).lean();
  return res.json(posts.map(serializeBlogPost));
}

export async function getBlogBySlug(req, res) {
  const post = await BlogPost.findOne({ slug: req.params.slug }).lean();
  if (!post) throw new HttpError(404, 'Blog post not found');
  
  // Check if blog is publicly accessible
  if (!post.published || post.status !== 'active') {
    throw new HttpError(404, 'Blog post not found');
  }
  
  return res.json(serializeBlogPost(post));
}

export async function getBlogById(req, res) {
  const post = await BlogPost.findById(req.params.id).lean();
  if (!post) throw new HttpError(404, 'Blog post not found');
  return res.json(serializeBlogPost(post));
}

export async function createBlog(req, res) {
  const data = normalizeBody(req.body);
  if (!data.title || !data.content) throw new HttpError(400, 'Title and content are required');

  // Auto-generate excerpt from content if not provided
  if (!data.excerpt && data.content) {
    data.excerpt = generateExcerpt(data.content, getExcerptLength());
  }

  // Auto-calculate reading time if not provided
  if (!data.readTime) {
    data.readTime = calculateReadTime(data.content);
  }

  const slug = req.body.slug ? req.body.slug : await uniqueSlug(BlogPost, data.title);
  
  // Set audit fields
  if (req.user && req.user._id) {
    data.createdBy = req.user._id;
    data.updatedBy = req.user._id;
  }

  const post = await BlogPost.create({ ...data, slug });

  await logAudit({ action: 'create', module: 'blogs', details: `Created blog post "${post.title}"`, req });
  return res.status(201).json(serializeBlogPost(post.toObject()));
}

export async function updateBlog(req, res) {
  const post = await BlogPost.findById(req.params.id);
  if (!post) throw new HttpError(404, 'Blog post not found');

  const data = normalizeBody(req.body);
  
  // Handle slug update
  if (req.body.slug) {
    post.slug = req.body.slug;
  } else if (data.title && data.title !== post.title) {
    post.slug = await uniqueSlug(BlogPost, data.title, post._id);
  }

  // Auto-calculate reading time if content changed and readTime not explicitly provided
  if (data.content && data.content !== post.content && !req.body.readTime && !req.body.read_time) {
    data.readTime = calculateReadTime(data.content);
  }

  // Update audit field
  if (req.user && req.user._id) {
    data.updatedBy = req.user._id;
  }

  Object.assign(post, data);
  await post.save();

  await logAudit({ action: 'update', module: 'blogs', details: `Updated blog post "${post.title}"`, req });
  return res.json(serializeBlogPost(post.toObject()));
}

export async function deleteBlog(req, res) {
  const post = await BlogPost.findById(req.params.id);
  if (!post) throw new HttpError(404, 'Blog post not found');

  await post.deleteOne();
  await logAudit({ action: 'delete', module: 'blogs', details: `Deleted blog post "${post.title}"`, req });
  return res.json({ success: true });
}

export async function togglePublish(req, res) {
  const post = await BlogPost.findById(req.params.id);
  if (!post) throw new HttpError(404, 'Blog post not found');

  post.published = !post.published;
  if (req.user && req.user._id) {
    post.updatedBy = req.user._id;
  }
  await post.save();

  await logAudit({ action: post.published ? 'publish' : 'unpublish', module: 'blogs', details: `${post.published ? 'Published' : 'Unpublished'} blog post "${post.title}"`, req });
  return res.json(serializeBlogPost(post.toObject()));
}

export async function toggleFeature(req, res) {
  const post = await BlogPost.findById(req.params.id);
  if (!post) throw new HttpError(404, 'Blog post not found');

  post.featureOnHomePage = !post.featureOnHomePage;
  if (req.user && req.user._id) {
    post.updatedBy = req.user._id;
  }
  await post.save();

  await logAudit({ action: post.featureOnHomePage ? 'feature' : 'unfeature', module: 'blogs', details: `${post.featureOnHomePage ? 'Featured' : 'Unfeatured'} blog post "${post.title}" on homepage`, req });
  return res.json(serializeBlogPost(post.toObject()));
}

export async function toggleStatus(req, res) {
  const post = await BlogPost.findById(req.params.id);
  if (!post) throw new HttpError(404, 'Blog post not found');

  post.status = post.status === 'active' ? 'inactive' : 'active';
  if (req.user && req.user._id) {
    post.updatedBy = req.user._id;
  }
  await post.save();

  await logAudit({ action: post.status === 'active' ? 'activate' : 'deactivate', module: 'blogs', details: `${post.status === 'active' ? 'Activated' : 'Deactivated'} blog post "${post.title}"`, req });
  return res.json(serializeBlogPost(post.toObject()));
}

export default { 
  listBlogs, 
  getPublicBlogs, 
  getFeaturedBlogs, 
  getBlogBySlug, 
  getBlogById,
  createBlog, 
  updateBlog, 
  deleteBlog, 
  togglePublish, 
  toggleFeature,
  toggleStatus
};