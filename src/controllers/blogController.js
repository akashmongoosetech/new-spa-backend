import BlogPost from '../models/Blog.js';
import { uniqueSlug } from '../utils/slugify.js';
import { serializeBlogPost } from '../utils/serializers.js';
import { HttpError } from '../utils/api.js';
import { logAudit } from '../services/auditService.js';

function normalizeBody(b) {
  const out = {};
  if (b.title !== undefined) out.title = b.title;
  if (b.category !== undefined) out.category = b.category;
  if (b.author !== undefined) out.author = b.author;
  if (b.date !== undefined) out.date = b.date ? new Date(b.date) : undefined;
  if (b.read_time !== undefined) out.readTime = Number(b.read_time) || null;
  if (b.readTime !== undefined) out.readTime = Number(b.readTime) || null;
  if (b.excerpt !== undefined) out.excerpt = b.excerpt;
  if (b.summary !== undefined) out.summary = b.summary;
  if (b.content !== undefined) out.content = b.content;
  if (b.image_url !== undefined) out.imageUrl = b.image_url;
  if (b.imageUrl !== undefined) out.imageUrl = b.imageUrl;
  if (b.cover_image !== undefined) out.coverImage = b.cover_image;
  if (b.coverImage !== undefined) out.coverImage = b.coverImage;
  if (b.tags !== undefined) out.tags = b.tags;
  if (b.published !== undefined) out.published = !(b.published === false || b.published === 0 || b.published === '0');
  return out;
}

export async function listBlogs(req, res) {
  const query = req.query.all === '1' ? {} : { published: true };
  const posts = await BlogPost.find(query).sort({ createdAt: -1 }).lean();
  return res.json(posts.map(serializeBlogPost));
}

export async function createBlog(req, res) {
  const data = normalizeBody(req.body);
  if (!data.title || !data.content) throw new HttpError(400, 'Title and content are required');

  const slug = req.body.slug ? req.body.slug : await uniqueSlug(BlogPost, data.title);
  const post = await BlogPost.create({ ...data, slug });

  await logAudit({ action: 'create', module: 'blogs', details: `Created blog post "${post.title}"`, req });
  return res.status(201).json(serializeBlogPost(post.toObject()));
}

export async function updateBlog(req, res) {
  const post = await BlogPost.findById(req.params.id);
  if (!post) throw new HttpError(404, 'Blog post not found');

  const data = normalizeBody(req.body);
  if (req.body.slug) {
    post.slug = req.body.slug;
  } else if (data.title && data.title !== post.title) {
    post.slug = await uniqueSlug(BlogPost, data.title, post._id);
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

export default { listBlogs, createBlog, updateBlog, deleteBlog };