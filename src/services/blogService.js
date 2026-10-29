import { randomUUID } from 'node:crypto';
import BlogPost from '../models/Blog.js';
import BlogCategory from '../models/BlogCategory.js';
import { HttpError } from '../utils/api.js';
import { sanitizeHtml, extractText, calculateReadTime } from '../utils/sanitize.js';
import {
  MAX_EXCERPT_TEXT,
  MAX_SECTIONS,
  buildSearchText,
  escapeRegExp,
  normalizeBlogSlug,
  normalizeCanonicalUrl,
  normalizeImageUrl,
  normalizeKeywords,
  normalizeStatus,
  normalizeTags,
  normalizeBoolean,
} from '../utils/blogContent.js';
import { parseBlogInput, parseCategoryInput } from '../utils/blogValidation.js';

const PUBLIC_SORT = {
  publishedAt: { publishedAt: -1, createdAt: -1 },
  '-publishedAt': { publishedAt: -1, createdAt: -1 },
  createdAt: { createdAt: 1 },
  '-createdAt': { createdAt: -1 },
  updatedAt: { updatedAt: 1 },
  '-updatedAt': { updatedAt: -1 },
  title: { title: 1 },
  '-title': { title: -1 },
};

function asText(value, max = 2000) {
  return extractText(String(value || '')).replace(/\s+/g, ' ').trim().slice(0, max);
}

function sanitizedHtml(value) {
  return sanitizeHtml(String(value || ''));
}

function normalizeSections(sections) {
  const list = Array.isArray(sections) ? sections.slice(0, MAX_SECTIONS) : [];
  const ordered = list
    .map((section, index) => {
      const order = Number.isFinite(Number(section?.order)) ? Number(section.order) : index;
      return { section, order, index };
    })
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({ section }, index) => ({
      id: String(section?.id || '').trim().slice(0, 80) || randomUUID(),
      heading: asText(section?.heading, 300),
      content: sanitizedHtml(section?.content),
      order: index,
    }));
  return ordered;
}

function normalizeSeo(seo = {}) {
  const input = seo && typeof seo === 'object' ? seo : {};
  const canonicalUrl = normalizeCanonicalUrl(input.canonicalUrl);
  if (String(input.canonicalUrl || '').trim() && !canonicalUrl) {
    throw new HttpError(400, 'Canonical URL must be an approved HTTPS URL.', {
      issues: [{ field: 'seo.canonicalUrl', message: 'Use an HTTPS URL on the configured site domain.' }],
    });
  }
  const ogImageUrl = normalizeImageUrl(input.ogImageUrl);
  if (String(input.ogImageUrl || '').trim() && !ogImageUrl) {
    throw new HttpError(400, 'Open Graph image URL must be an HTTPS URL or an approved site path.', {
      issues: [{ field: 'seo.ogImageUrl', message: 'Enter a valid HTTPS image URL.' }],
    });
  }
  const twitterImageUrl = normalizeImageUrl(input.twitterImageUrl);
  if (String(input.twitterImageUrl || '').trim() && !twitterImageUrl) {
    throw new HttpError(400, 'Twitter/X image URL must be an HTTPS URL or an approved site path.', {
      issues: [{ field: 'seo.twitterImageUrl', message: 'Enter a valid HTTPS image URL.' }],
    });
  }
  return {
    metaTitle: asText(input.metaTitle, 60),
    metaDescription: asText(input.metaDescription, 160),
    canonicalUrl,
    ogTitle: asText(input.ogTitle, 70),
    ogDescription: asText(input.ogDescription, 200),
    ogImageUrl,
    twitterTitle: asText(input.twitterTitle, 70),
    twitterDescription: asText(input.twitterDescription, 200),
    twitterImageUrl,
    keywords: normalizeKeywords(input.keywords),
  };
}

/**
 * Build only the writable blog fields. Legacy aliases are normalized here so
 * the old admin form can keep working while the new UI is rolled out.
 */
export function normalizeBlogPayload(body = {}, { partial = false } = {}) {
  const b = body || {};
  const out = {};

  const has = (key) => Object.prototype.hasOwnProperty.call(b, key);
  const pick = (keys) => keys.find((key) => has(key));

  const titleKey = pick(['title']);
  if (titleKey) out.title = asText(b[titleKey], 500);
  const slugKey = pick(['slug']);
  if (slugKey) out.slug = normalizeBlogSlug(b[slugKey]);
  const contentKey = pick(['content']);
  if (contentKey) out.content = sanitizedHtml(b[contentKey]);

  const excerptKey = pick(['excerpt', 'summary']);
  if (excerptKey) out.excerpt = sanitizedHtml(b[excerptKey]);

  const featuredImageKey = pick(['featuredImageUrl', 'featured_image_url', 'imageUrl', 'image_url', 'coverImage', 'cover_image']);
  if (featuredImageKey) {
    const raw = String(b[featuredImageKey] || '').trim();
    const normalized = normalizeImageUrl(raw);
    if (raw && !normalized) {
      throw new HttpError(400, 'Featured image URL must be an HTTPS URL or an approved site path.', {
        issues: [{ field: 'featuredImageUrl', message: 'Enter a valid HTTPS image URL.' }],
      });
    }
    out.featuredImageUrl = normalized;
    // Keep the historical aliases in sync so clearing an image in the new
    // admin does not resurrect the old cover image during pre-validation.
    out.imageUrl = normalized;
    out.coverImage = normalized;
  }

  const featuredAltKey = pick(['featuredImageAlt', 'featured_image_alt']);
  if (featuredAltKey) out.featuredImageAlt = asText(b[featuredAltKey], 300);

  const categoryKey = pick(['category']);
  if (categoryKey) out.category = asText(b[categoryKey], 100);
  const categoryIdKey = pick(['categoryId', 'category_id']);
  if (categoryIdKey) out.categoryId = String(b[categoryIdKey] || '').trim();
  else if (categoryKey) out.categoryId = '';

  if (has('author')) out.author = asText(b.author, 200);
  if (has('therapistName') || has('therapist_name')) out.therapistName = asText(b.therapistName ?? b.therapist_name, 200);
  if (has('therapistAvatarUrl') || has('therapist_avatar_url')) {
    const raw = String(b.therapistAvatarUrl ?? b.therapist_avatar_url ?? '').trim();
    const normalized = normalizeImageUrl(raw);
    if (raw && !normalized) {
      throw new HttpError(400, 'Therapist avatar URL must be an HTTPS URL or an approved site path.', {
        issues: [{ field: 'therapistAvatarUrl', message: 'Enter a valid HTTPS image URL.' }],
      });
    }
    out.therapistAvatarUrl = normalized;
  }

  const tagsKey = pick(['tags']);
  if (tagsKey) out.tags = normalizeTags(b[tagsKey]);

  const statusKey = pick(['status']);
  if (statusKey) {
    const rawStatus = String(b[statusKey] || '').toLowerCase().trim();
    if (rawStatus === 'active') {
      // In the old admin UI "active" meant published, but legacy records can
      // also carry an explicit published=false flag. Honour that flag first.
      out.status = has('published') && !normalizeBoolean(b.published) ? 'draft' : 'published';
    } else {
      out.status = normalizeStatus(b[statusKey], 'draft');
    }
  } else if (has('published')) out.status = normalizeBoolean(b.published) ? 'published' : 'draft';

  const featuredKey = pick(['isFeatured', 'featureOnHomePage', 'feature_on_home_page', 'featured']);
  if (featuredKey) out.isFeatured = normalizeBoolean(b[featuredKey]);

  if (has('sections')) out.sections = normalizeSections(b.sections);

  if (has('seo')) out.seo = normalizeSeo(b.seo);

  if (has('publishedAt') || has('published_at')) {
    out.publishedAt = b.publishedAt || b.published_at || '';
  }
  if (has('expectedUpdatedAt') || has('expected_updated_at')) {
    out.expectedUpdatedAt = String(b.expectedUpdatedAt || b.expected_updated_at || '');
  }

  return out;
}

function currentBlogPayload(post) {
  const p = post.toObject ? post.toObject() : post;
  return {
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt || p.summary || '',
    content: p.content,
    featuredImageUrl: p.featuredImageUrl || p.imageUrl || p.coverImage || '',
    featuredImageAlt: p.featuredImageAlt || '',
    category: p.category || '',
    categoryId: p.categoryId ? p.categoryId.toString() : '',
    author: p.author || '',
    therapistName: p.therapistName || '',
    therapistAvatarUrl: p.therapistAvatarUrl || '',
    tags: p.tags || [],
    status: p.status === 'unpublished'
      ? 'unpublished'
      : (p.status === 'published' || (p.status === 'active' && p.published) ? 'published' : 'draft'),
    isFeatured: Boolean(p.isFeatured || p.featureOnHomePage),
    sections: (p.sections || []).map((section) => ({
      id: section.id,
      heading: section.heading,
      content: section.content,
      order: section.order,
    })),
    seo: p.seo || {},
  };
}

async function resolveCategory(payload) {
  if (payload.categoryId) {
    const category = await BlogCategory.findById(payload.categoryId);
    if (!category) {
      throw new HttpError(400, 'The selected category no longer exists.', {
        issues: [{ field: 'categoryId', message: 'Choose another category.' }],
      });
    }
    return { category, name: category.name, id: category._id };
  }
  if (!payload.category) return { category: null, name: '', id: null };
  const name = String(payload.category).replace(/\s+/g, ' ').trim().slice(0, 100);
  const slug = normalizeBlogSlug(name).slice(0, 120);
  if (!slug) {
    throw new HttpError(400, 'Category name must contain at least one letter or number.', {
      issues: [{ field: 'category', message: 'Enter a valid category name.' }],
    });
  }
  let category = await BlogCategory.findOne({ slug });
  if (!category) {
    category = await BlogCategory.create({ name, slug });
  }
  return { category, name: category.name, id: category._id };
}

function validateForPublication(payload) {
  const issues = [];
  if (!payload.title) issues.push({ field: 'title', message: 'Title is required.' });
  if (!payload.slug) issues.push({ field: 'slug', message: 'Slug is required.' });
  if (!payload.content) issues.push({ field: 'content', message: 'Content is required.' });
  if (!payload.category) issues.push({ field: 'category', message: 'Category is required before publishing.' });
  if (!payload.excerptText && !extractText(payload.content)) {
    issues.push({ field: 'content', message: 'Add article content before publishing.' });
  }
  if (payload.isFeatured && !payload.featuredImageUrl) {
    issues.push({ field: 'featuredImageUrl', message: 'Featured posts need a featured image.' });
  }
  if (payload.featuredImageUrl && !payload.featuredImageAlt) {
    issues.push({ field: 'featuredImageAlt', message: 'Describe the featured image for accessibility.' });
  }
  if (issues.length) {
    throw new HttpError(400, 'This article is not ready to publish yet.', { issues });
  }
}

export async function slugIsAvailable(slug, excludeId = null) {
  const query = {
    $or: [
      { slug },
      { previousSlugs: slug },
    ],
  };
  if (excludeId) query._id = { $ne: excludeId };
  return !(await BlogPost.exists(query));
}

export async function uniqueBlogSlug(value, excludeId = null) {
  const base = normalizeBlogSlug(value) || 'article';
  let candidate = base;
  let suffix = 2;
  while (!(await slugIsAvailable(candidate, excludeId))) {
    candidate = `${base.slice(0, 155)}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function normalizeDate(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function checkOptimisticVersion(post, expectedUpdatedAt) {
  if (!expectedUpdatedAt) return;
  const expected = new Date(expectedUpdatedAt);
  if (Number.isNaN(expected.getTime())) {
    throw new HttpError(400, 'Invalid edit version.');
  }
  const actual = post.updatedAt ? new Date(post.updatedAt) : null;
  if (actual && Math.abs(actual.getTime() - expected.getTime()) > 1500) {
    throw new HttpError(409, 'This article was changed by someone else. Reload it before saving.');
  }
}

export async function createBlogPost(body, user) {
  const payload = normalizeBlogPayload(body, { partial: false });
  const parsed = parseBlogInput({
    ...payload,
    status: payload.status || 'draft',
    slug: payload.slug || '',
    sections: payload.sections || [],
    seo: payload.seo || {},
  });

  const slug = parsed.slug
    ? (await uniqueBlogSlug(parsed.slug))
    : await uniqueBlogSlug(parsed.title);
  if (parsed.slug && slug !== parsed.slug) {
    // An explicit existing slug is a conflict, not an invitation to silently
    // redirect the admin to a different public URL.
    throw new HttpError(409, 'That slug is already in use. Choose a different URL.', {
      issues: [{ field: 'slug', message: 'This slug is already in use.' }],
    });
  }
  const category = await resolveCategory({ ...parsed });

  const excerptText = extractText(parsed.excerpt).slice(0, MAX_EXCERPT_TEXT);
  const readingTime = calculateReadTime([parsed.content, ...parsed.sections.map((s) => s.content)]);
  const post = new BlogPost({
    ...parsed,
    slug,
    category: category.name || parsed.category,
    categoryId: category.id,
    excerptText,
    summary: excerptText,
    readingTime,
    readTime: readingTime,
    searchText: buildSearchText({ ...parsed, excerptText }),
    publishedAt: parsed.status === 'published' ? normalizeDate(parsed.publishedAt, new Date()) : null,
    createdBy: user?._id,
    updatedBy: user?._id,
  });

  if (post.status === 'published') validateForPublication(post);
  await post.save();
  return post;
}

export async function updateBlogPost(post, body, user) {
  if (!post) throw new HttpError(404, 'Blog post not found');
  const changes = normalizeBlogPayload(body, { partial: true });
  checkOptimisticVersion(post, changes.expectedUpdatedAt);
  delete changes.expectedUpdatedAt;

  const previous = currentBlogPayload(post);
  const merged = { ...previous, ...changes };
  const parsed = parseBlogInput({
    ...merged,
    status: merged.status || previous.status || 'draft',
    slug: merged.slug || previous.slug || '',
    sections: merged.sections || [],
    seo: merged.seo || {},
  });

  const slugChanged = parsed.slug && parsed.slug !== post.slug;
  if (slugChanged) {
    if (!(await slugIsAvailable(parsed.slug, post._id))) {
      throw new HttpError(409, 'That slug is already in use. Choose a different URL.', {
        issues: [{ field: 'slug', message: 'This slug is already in use.' }],
      });
    }
  }

  const category = await resolveCategory({ ...parsed });
  const excerptText = extractText(parsed.excerpt).slice(0, MAX_EXCERPT_TEXT);
  const readingTime = calculateReadTime([parsed.content, ...parsed.sections.map((s) => s.content)]);
  const { expectedUpdatedAt: _version, ...parsedFields } = parsed;
  const next = {
    ...parsedFields,
    slug: parsed.slug,
    category: category.name || parsed.category,
    categoryId: category.id,
    excerptText,
    summary: excerptText,
    readingTime,
    readTime: readingTime,
    searchText: buildSearchText({ ...parsed, excerptText }),
    updatedBy: user?._id,
  };

  if (slugChanged) {
    const history = new Set((post.previousSlugs || []).filter(Boolean));
    history.add(post.slug);
    history.delete(parsed.slug);
    next.previousSlugs = Array.from(history);
  }
  if (parsed.status === 'published' && !post.publishedAt) {
    next.publishedAt = normalizeDate(parsed.publishedAt, new Date());
  } else if (changes.publishedAt !== undefined) {
    next.publishedAt = normalizeDate(changes.publishedAt, post.publishedAt);
  } else {
    next.publishedAt = post.publishedAt;
  }

  const candidate = new BlogPost({ ...post.toObject(), ...next, _id: post._id });
  if (candidate.status === 'published') validateForPublication(candidate);

  Object.assign(post, next);
  await post.save();
  return post;
}

export async function deleteBlogPost(post) {
  if (!post) throw new HttpError(404, 'Blog post not found');
  await post.deleteOne();
}

export async function setBlogStatus(post, status) {
  if (!post) throw new HttpError(404, 'Blog post not found');
  const nextStatus = normalizeStatus(status, 'draft');
  if (nextStatus === 'published') {
    const candidate = new BlogPost({
      ...post.toObject(),
      status: 'published',
      published: true,
      publishedAt: post.publishedAt || new Date(),
    });
    validateForPublication(candidate);
  }
  post.status = nextStatus;
  post.published = nextStatus === 'published';
  if (post.status === 'published' && !post.publishedAt) post.publishedAt = new Date();
  await post.save();
  return post;
}

export async function setBlogFeatured(post, isFeatured) {
  if (!post) throw new HttpError(404, 'Blog post not found');
  const nextFeatured = Boolean(isFeatured);
  if (nextFeatured && post.status === 'published') {
    validateForPublication(new BlogPost({
      ...post.toObject(),
      isFeatured: true,
      featureOnHomePage: true,
    }));
  }
  post.isFeatured = nextFeatured;
  post.featureOnHomePage = nextFeatured;
  await post.save();
  return post;
}

/**
 * Public visibility is deliberately status-based, with an explicit legacy
 * branch for records that have not been through the migration yet. The old
 * schema stored `status=active` plus `published=true` for live posts; an
 * `active` record with `published=false` is a draft and must stay private.
 */
export function publishedBlogQuery(extra = {}) {
  const visibility = {
    $or: [
      { status: 'published' },
      { status: 'active', published: true },
    ],
  };
  if (!extra || !Object.keys(extra).length) return visibility;
  return { $and: [visibility, extra] };
}

function pagination(query) {
  const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit || '10', 10) || 10));
  return { page, limit, skip: (page - 1) * limit };
}

function publicQuery(filters = {}) {
  const query = publishedBlogQuery();
  const category = String(filters.category || '').trim();
  if (category) {
    query.category = { $regex: `^${escapeRegExp(category)}$`, $options: 'i' };
  }
  const tag = String(filters.tag || '').replace(/^#/, '').trim();
  if (tag) query.tags = { $regex: `^${escapeRegExp(tag)}$`, $options: 'i' };
  if (filters.isFeatured === true || filters.isFeatured === 'true' || filters.isFeatured === '1') {
    query.$and = [{ $or: [{ isFeatured: true }, { featureOnHomePage: true }] }];
  }
  if (filters.q) query.$text = { $search: String(filters.q).slice(0, 100) };
  return query;
}

export async function listPublicBlogPosts(filters = {}) {
  const { page, limit, skip } = pagination(filters);
  const query = publicQuery(filters);
  const sort = PUBLIC_SORT[filters.sort] || PUBLIC_SORT['-publishedAt'];
  const [items, total] = await Promise.all([
    BlogPost.find(query).sort(sort).skip(skip).limit(limit).lean(),
    BlogPost.countDocuments(query),
  ]);
  return { items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

export async function listFeaturedBlogPosts(limit = 6) {
  return BlogPost.find(publishedBlogQuery({ $or: [{ isFeatured: true }, { featureOnHomePage: true }] }))
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(Math.min(12, Math.max(1, limit)))
    .lean();
}

export async function findPublishedBlogBySlug(slug) {
  const normalized = normalizeBlogSlug(slug);
  if (!normalized) throw new HttpError(404, 'Blog post not found');
  let post = await BlogPost.findOne(publishedBlogQuery({ slug: normalized })).lean();
  if (post) return { post, redirectTo: '' };
  post = await BlogPost.findOne(publishedBlogQuery({ previousSlugs: normalized })).lean();
  if (!post) throw new HttpError(404, 'Blog post not found');
  return { post, redirectTo: `/blog/${post.slug}/` };
}

export async function listRelatedBlogPosts(post, limit = 3) {
  if (!post) return [];
  const base = publishedBlogQuery({ _id: { $ne: post._id } });
  if (post.category) {
    const related = await BlogPost.find({ ...base, category: post.category })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean();
    if (related.length) return related;
  }
  return BlogPost.find(base).sort({ publishedAt: -1 }).limit(limit).lean();
}

export async function getAdjacentBlogPosts(post) {
  const date = post.publishedAt || post.createdAt;
  if (!date) return { previous: null, next: null };
  const [previous, next] = await Promise.all([
    BlogPost.findOne(publishedBlogQuery({ _id: { $ne: post._id }, publishedAt: { $lt: date } }))
      .sort({ publishedAt: -1 })
      .lean(),
    BlogPost.findOne(publishedBlogQuery({ _id: { $ne: post._id }, publishedAt: { $gt: date } }))
      .sort({ publishedAt: 1 })
      .lean(),
  ]);
  return { previous, next };
}

export async function listAdminBlogPosts(filters = {}) {
  const { page, limit, skip } = pagination(filters);
  const query = {};
  const status = String(filters.status || '').trim();
  if (status && status !== 'all') query.status = normalizeStatus(status, 'draft');
  if (filters.category) query.category = { $regex: `^${escapeRegExp(String(filters.category))}$`, $options: 'i' };
  if (filters.isFeatured === true || filters.isFeatured === 'true' || filters.isFeatured === '1') {
    query.$and = [{ $or: [{ isFeatured: true }, { featureOnHomePage: true }] }];
  }
  if (filters.isFeatured === false || filters.isFeatured === 'false' || filters.isFeatured === '0') {
    query.$and = [{ isFeatured: { $ne: true } }, { featureOnHomePage: { $ne: true } }];
  }
  const q = String(filters.q || '').trim().slice(0, 100);
  if (q) {
    const regex = { $regex: escapeRegExp(q), $options: 'i' };
    query.$or = [
      { title: regex },
      { slug: regex },
      { author: regex },
      { category: regex },
      { tags: regex },
    ];
  }
  const sortKey = String(filters.sort || '-updatedAt');
  const sort = PUBLIC_SORT[sortKey] || PUBLIC_SORT['-updatedAt'];
  const [items, total] = await Promise.all([
    BlogPost.find(query).sort(sort).skip(skip).limit(limit).lean(),
    BlogPost.countDocuments(query),
  ]);
  return { items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

export async function listPublicCategories() {
  const rows = await BlogPost.aggregate([
    { $match: publishedBlogQuery({ category: { $exists: true, $nin: ['', null] } }) },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((row) => ({
    name: row._id,
    slug: normalizeBlogSlug(row._id),
    count: row.count,
  }));
}

export async function listPublicTags() {
  const rows = await BlogPost.aggregate([
    { $match: publishedBlogQuery({ tags: { $exists: true, $type: 'array' } }) },
    { $unwind: '$tags' },
    { $match: { tags: { $nin: ['', null] } } },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((row) => ({
    name: row._id,
    slug: normalizeBlogSlug(row._id),
    count: row.count,
  }));
}

export async function listAdminCategories() {
  const categories = await BlogCategory.find({}).sort({ name: 1 }).lean();
  return Promise.all(categories.map(async (category) => ({
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    description: category.description || '',
    count: await BlogPost.countDocuments({
      $or: [{ categoryId: category._id }, { category: category.name }],
    }),
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  })));
}

export async function createCategory(body, user) {
  const parsed = parseCategoryInput(body);
  const name = String(parsed.name).replace(/\s+/g, ' ').trim();
  const slug = normalizeBlogSlug(parsed.slug || name).slice(0, 120);
  if (!slug) throw new HttpError(400, 'Category name must contain at least one letter or number.');
  const existing = await BlogCategory.findOne({ slug });
  if (existing) throw new HttpError(409, 'A category with that name already exists.');
  return BlogCategory.create({ ...parsed, name, slug, createdBy: user?._id });
}

export async function updateCategory(category, body) {
  if (!category) throw new HttpError(404, 'Category not found');
  const parsed = parseCategoryInput(body);
  const name = String(parsed.name).replace(/\s+/g, ' ').trim();
  const slug = normalizeBlogSlug(parsed.slug || name).slice(0, 120);
  const duplicate = await BlogCategory.findOne({ slug, _id: { $ne: category._id } });
  if (duplicate) throw new HttpError(409, 'A category with that name already exists.');
  const oldName = category.name;
  category.name = name;
  category.slug = slug;
  category.description = parsed.description || '';
  await category.save();
  await BlogPost.updateMany(
    { $or: [{ categoryId: category._id }, { category: oldName }] },
    { $set: { category: category.name, categoryId: category._id } }
  );
  return category;
}

export async function deleteCategory(category) {
  if (!category) throw new HttpError(404, 'Category not found');
  const count = await BlogPost.countDocuments({
    $or: [{ categoryId: category._id }, { category: category.name }],
  });
  if (count > 0) {
    throw new HttpError(409, `This category is used by ${count} article${count === 1 ? '' : 's'}. Reassign them first.`);
  }
  await category.deleteOne();
}

export default {
  normalizeBlogPayload,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  setBlogStatus,
  setBlogFeatured,
  publishedBlogQuery,
  listPublicBlogPosts,
  listFeaturedBlogPosts,
  findPublishedBlogBySlug,
  listRelatedBlogPosts,
  getAdjacentBlogPosts,
  listAdminBlogPosts,
  listPublicCategories,
  listPublicTags,
  listAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  uniqueBlogSlug,
  slugIsAvailable,
};
