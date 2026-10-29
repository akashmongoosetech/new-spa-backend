import BlogCategory from '../models/BlogCategory.js';
import BlogPost from '../models/Blog.js';
import { serializeBlogPost } from '../utils/serializers.js';
import { HttpError } from '../utils/api.js';
import { logAudit } from '../services/auditService.js';
import { refreshSource } from '../services/ingestService.js';
import {
  createBlogPost,
  createCategory as createBlogCategory,
  deleteBlogPost,
  deleteCategory,
  findPublishedBlogBySlug,
  getAdjacentBlogPosts,
  listAdminBlogPosts,
  listAdminCategories,
  listFeaturedBlogPosts,
  listPublicBlogPosts,
  listPublicCategories,
  listPublicTags,
  listRelatedBlogPosts,
  publishedBlogQuery,
  setBlogFeatured,
  setBlogStatus,
  updateBlogPost,
  updateCategory,
} from '../services/blogService.js';
import { normalizeStatus } from '../utils/blogContent.js';
import { buildBlogPostingJsonLd, resolveBlogSeo } from '../utils/blogSeo.js';

function setPublicCache(res) {
  res.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
}

function noStore(res) {
  res.set('Cache-Control', 'no-store');
}

async function findPostById(id) {
  const post = await BlogPost.findById(id);
  if (!post) throw new HttpError(404, 'Blog post not found');
  return post;
}

async function findCategoryById(id) {
  const category = await BlogCategory.findById(id);
  if (!category) throw new HttpError(404, 'Category not found');
  return category;
}

// ---------------------------------------------------------------------------
// Legacy endpoints (/api/blogs). These deliberately keep their old array
// response shape while the new admin and public APIs are rolled out.
// ---------------------------------------------------------------------------

export async function listBlogs(req, res) {
  if (req.query.all === '1') {
    const role = req.user && req.user.role;
    if (!req.user || !['Super Admin', 'Admin', 'Manager'].includes(role)) {
      throw new HttpError(403, 'You do not have permission to view drafts');
    }
    const { items } = await listAdminBlogPosts({ ...req.query, page: 1, limit: 500 });
    noStore(res);
    return res.json(items.map((post) => serializeBlogPost(post)));
  }
  const { items } = await listPublicBlogPosts({ ...req.query, page: 1, limit: 200 });
  setPublicCache(res);
  return res.json(items.map((post) => serializeBlogPost(post)));
}

export async function getPublicBlogs(req, res) {
  const { items } = await listPublicBlogPosts({ ...req.query, page: 1, limit: 200 });
  setPublicCache(res);
  return res.json(items.map((post) => serializeBlogPost(post)));
}

export async function getFeaturedBlogs(req, res) {
  const items = await listFeaturedBlogPosts(Number(req.query.limit) || 6);
  setPublicCache(res);
  return res.json(items.map((post) => serializeBlogPost(post)));
}

export async function getBlogBySlug(req, res) {
  const { post, redirectTo } = await findPublishedBlogBySlug(req.params.slug);
  setPublicCache(res);
  return res.json(serializeBlogPost(post, { redirectTo }));
}

export async function getBlogById(req, res) {
  const post = await findPostById(req.params.id);
  noStore(res);
  return res.json(serializeBlogPost(post.toObject()));
}

export async function createBlog(req, res) {
  const post = await createBlogPost(req.body, req.user);
  await logAudit({ action: 'create', module: 'blogs', details: `Created blog post "${post.title}"`, req });
  refreshSource('blog');
  noStore(res);
  return res.status(201).json(serializeBlogPost(post.toObject()));
}

export async function updateBlog(req, res) {
  const post = await findPostById(req.params.id);
  const updated = await updateBlogPost(post, req.body, req.user);
  await logAudit({ action: 'update', module: 'blogs', details: `Updated blog post "${updated.title}"`, req });
  refreshSource('blog');
  noStore(res);
  return res.json(serializeBlogPost(updated.toObject()));
}

export async function deleteBlog(req, res) {
  const post = await findPostById(req.params.id);
  const title = post.title;
  await deleteBlogPost(post);
  await logAudit({ action: 'delete', module: 'blogs', details: `Deleted blog post "${title}"`, req });
  refreshSource('blog');
  noStore(res);
  return res.json({ success: true });
}

export async function togglePublish(req, res) {
  const post = await findPostById(req.params.id);
  const nextStatus = post.status === 'published' ? 'unpublished' : 'published';
  const updated = await setBlogStatus(post, nextStatus);
  await logAudit({
    action: nextStatus === 'published' ? 'publish' : 'unpublish',
    module: 'blogs',
    details: `${nextStatus === 'published' ? 'Published' : 'Unpublished'} blog post "${updated.title}"`,
    req,
  });
  refreshSource('blog');
  noStore(res);
  return res.json(serializeBlogPost(updated.toObject()));
}

export async function toggleFeature(req, res) {
  const post = await findPostById(req.params.id);
  const updated = await setBlogFeatured(post, !(post.isFeatured || post.featureOnHomePage));
  await logAudit({
    action: updated.isFeatured ? 'feature' : 'unfeature',
    module: 'blogs',
    details: `${updated.isFeatured ? 'Featured' : 'Unfeatured'} blog post "${updated.title}"`,
    req,
  });
  noStore(res);
  return res.json(serializeBlogPost(updated.toObject()));
}

export async function toggleStatus(req, res) {
  const post = await findPostById(req.params.id);
  const requested = req.body && req.body.status
    ? normalizeStatus(req.body.status, post.status)
    : (post.status === 'published' ? 'unpublished' : 'published');
  const updated = await setBlogStatus(post, requested);
  await logAudit({ action: 'status', module: 'blogs', details: `Set "${updated.title}" to ${updated.status}`, req });
  refreshSource('blog');
  noStore(res);
  return res.json(serializeBlogPost(updated.toObject()));
}

// ---------------------------------------------------------------------------
// New admin API (/api/admin/blogs)
// ---------------------------------------------------------------------------

export async function adminListBlogs(req, res) {
  const result = await listAdminBlogPosts(req.query);
  noStore(res);
  return res.json({
    items: result.items.map((post) => serializeBlogPost(post)),
    pagination: result.pagination,
  });
}

export async function adminGetBlog(req, res) {
  const post = await findPostById(req.params.id);
  noStore(res);
  return res.json(serializeBlogPost(post.toObject()));
}

export async function adminCreateBlog(req, res) {
  const post = await createBlogPost(req.body, req.user);
  await logAudit({ action: 'create', module: 'blogs', details: `Created blog post "${post.title}"`, req });
  refreshSource('blog');
  noStore(res);
  return res.status(201).json(serializeBlogPost(post.toObject()));
}

export async function adminUpdateBlog(req, res) {
  const post = await findPostById(req.params.id);
  const updated = await updateBlogPost(post, req.body, req.user);
  await logAudit({ action: 'update', module: 'blogs', details: `Updated blog post "${updated.title}"`, req });
  refreshSource('blog');
  noStore(res);
  return res.json(serializeBlogPost(updated.toObject()));
}

export async function adminDeleteBlog(req, res) {
  const post = await findPostById(req.params.id);
  const title = post.title;
  await deleteBlogPost(post);
  await logAudit({ action: 'delete', module: 'blogs', details: `Deleted blog post "${title}"`, req });
  refreshSource('blog');
  noStore(res);
  return res.json({ success: true });
}

export async function adminSetStatus(req, res) {
  const post = await findPostById(req.params.id);
  const updated = await setBlogStatus(post, req.body.status);
  await logAudit({ action: 'status', module: 'blogs', details: `Set "${updated.title}" to ${updated.status}`, req });
  refreshSource('blog');
  noStore(res);
  return res.json(serializeBlogPost(updated.toObject()));
}

export async function adminSetFeatured(req, res) {
  const post = await findPostById(req.params.id);
  const updated = await setBlogFeatured(post, req.body.isFeatured);
  await logAudit({
    action: updated.isFeatured ? 'feature' : 'unfeature',
    module: 'blogs',
    details: `${updated.isFeatured ? 'Featured' : 'Unfeatured'} blog post "${updated.title}"`,
    req,
  });
  noStore(res);
  return res.json(serializeBlogPost(updated.toObject()));
}

// ---------------------------------------------------------------------------
// Admin categories
// ---------------------------------------------------------------------------

export async function adminListCategories(_req, res) {
  const categories = await listAdminCategories();
  noStore(res);
  return res.json(categories);
}

export async function adminCreateCategory(req, res) {
  const category = await createBlogCategory(req.body, req.user);
  await logAudit({ action: 'create', module: 'blog_categories', details: `Created blog category "${category.name}"`, req });
  noStore(res);
  return res.status(201).json({
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    description: category.description || '',
    count: 0,
  });
}

export async function adminUpdateCategory(req, res) {
  const category = await findCategoryById(req.params.id);
  const updated = await updateCategory(category, req.body);
  await logAudit({ action: 'update', module: 'blog_categories', details: `Updated blog category "${updated.name}"`, req });
  noStore(res);
  return res.json({
    id: updated._id.toString(),
    name: updated.name,
    slug: updated.slug,
    description: updated.description || '',
  });
}

export async function adminDeleteCategory(req, res) {
  const category = await findCategoryById(req.params.id);
  await deleteCategory(category);
  await logAudit({ action: 'delete', module: 'blog_categories', details: `Deleted blog category "${category.name}"`, req });
  noStore(res);
  return res.json({ success: true });
}

// ---------------------------------------------------------------------------
// New public API (/api/blog)
// ---------------------------------------------------------------------------

export async function publicListPosts(req, res) {
  const result = await listPublicBlogPosts(req.query);
  setPublicCache(res);
  return res.json({
    items: result.items.map((post) => serializeBlogPost(post)),
    pagination: result.pagination,
  });
}

export async function publicFeaturedPosts(req, res) {
  const items = await listFeaturedBlogPosts(Number(req.query.limit) || 6);
  setPublicCache(res);
  return res.json(items.map((post) => serializeBlogPost(post)));
}

export async function publicGetPost(req, res) {
  const { post, redirectTo } = await findPublishedBlogBySlug(req.params.slug);
  const [related, adjacent] = await Promise.all([
    listRelatedBlogPosts(post, 3),
    getAdjacentBlogPosts(post),
  ]);
  setPublicCache(res);
  return res.json({
    post: serializeBlogPost(post, { redirectTo }),
    related: related.map((item) => serializeBlogPost(item)),
    previous: adjacent.previous ? serializeBlogPost(adjacent.previous) : null,
    next: adjacent.next ? serializeBlogPost(adjacent.next) : null,
    redirectTo: redirectTo || null,
    jsonLd: buildBlogPostingJsonLd({ ...post, status: 'published', published: true }),
  });
}

export async function publicCategories(_req, res) {
  const categories = await listPublicCategories();
  setPublicCache(res);
  return res.json(categories);
}

export async function publicTags(_req, res) {
  const tags = await listPublicTags();
  setPublicCache(res);
  return res.json(tags);
}

export async function publicSitemap(_req, res) {
  const posts = await BlogPost.find(publishedBlogQuery())
    .select('slug title excerpt excerptText category author therapistName featuredImageUrl featuredImageAlt publishedAt updatedAt createdAt seo')
    .sort({ publishedAt: -1 })
    .limit(5000)
    .lean();
  setPublicCache(res);
  return res.json(posts.map((post) => {
    const withStatus = { ...post, status: 'published', published: true };
    const seo = resolveBlogSeo(withStatus);
    return {
      slug: post.slug,
      title: post.title,
      excerpt: post.excerptText || seo.description,
      featuredImageUrl: post.featuredImageUrl || '',
      featuredImageAlt: post.featuredImageAlt || '',
      publishedAt: post.publishedAt || post.createdAt,
      updatedAt: post.updatedAt || post.publishedAt || post.createdAt,
      url: seo.canonicalUrl,
      resolvedSeo: seo,
      jsonLd: buildBlogPostingJsonLd(withStatus, seo),
    };
  }));
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
  toggleStatus,
  adminListBlogs,
  adminGetBlog,
  adminCreateBlog,
  adminUpdateBlog,
  adminDeleteBlog,
  adminSetStatus,
  adminSetFeatured,
  adminListCategories,
  adminCreateCategory,
  adminUpdateCategory,
  adminDeleteCategory,
  publicListPosts,
  publicFeaturedPosts,
  publicGetPost,
  publicCategories,
  publicTags,
  publicSitemap,
};
