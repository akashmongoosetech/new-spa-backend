#!/usr/bin/env node
/**
 * Blog schema migration.
 *
 * Dry run (default):
 *   node scripts/migrate-blogs.js
 *
 * Apply (writes):
 *   node scripts/migrate-blogs.js --apply
 *
 * Production additionally requires --confirm-production. The script is
 * idempotent and never deletes posts.
 */
import mongoose from 'mongoose';
import env from '../src/config/env.js';
import BlogCategory from '../src/models/BlogCategory.js';
import {
  BLOG_STATUSES,
  buildSearchText,
  normalizeBlogSlug,
  normalizeTags,
} from '../src/utils/blogContent.js';
import { extractText, sanitizeHtml, calculateReadTime } from '../src/utils/sanitize.js';

const APPLY = process.argv.includes('--apply');
const CONFIRM_PRODUCTION = process.argv.includes('--confirm-production');
const LIMIT = (() => {
  const idx = process.argv.indexOf('--limit');
  if (idx === -1) return 0;
  const value = Number(process.argv[idx + 1]);
  return Number.isFinite(value) && value > 0 ? value : 0;
})();

function clean(value, max = 500) {
  return extractText(String(value || '')).replace(/\s+/g, ' ').trim().slice(0, max);
}

function mappedStatus(doc) {
  const raw = String(doc.status || '').toLowerCase().trim();
  if (BLOG_STATUSES.includes(raw)) return raw;
  if (raw === 'inactive') return 'unpublished';
  if (raw === 'active') return doc.published ? 'published' : 'draft';
  return doc.published ? 'published' : 'draft';
}

function safeSections(input) {
  const sections = Array.isArray(input) ? input.slice(0, 100) : [];
  return sections
    .map((section, index) => {
      const order = Number.isFinite(Number(section?.order)) ? Number(section.order) : index;
      return {
        section,
        order,
        index,
      };
    })
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({ section }, index) => ({
      id: String(section?.id || '').trim().slice(0, 80) || `section-${index + 1}`,
      heading: clean(section?.heading, 300),
      content: sanitizeHtml(section?.content || ''),
      order: index,
    }));
}

function uniqueSlug(base, taken) {
  const normalized = normalizeBlogSlug(base) || 'blog-post';
  let candidate = normalized;
  let suffix = 2;
  while (taken.has(candidate)) {
    candidate = `${normalized.slice(0, 155)}-${suffix}`;
    suffix += 1;
  }
  taken.add(candidate);
  return candidate;
}

async function main() {
  if (env.isProduction && APPLY && !CONFIRM_PRODUCTION) {
    throw new Error('Refusing to write to production without --confirm-production.');
  }

  await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 10000 });
  const collection = mongoose.connection.collection('blogposts');
  console.log(`[blog-migrate] Connected to ${mongoose.connection.name} (${APPLY ? 'APPLY' : 'DRY RUN'})`);

  let posts = await collection.find({}).sort({ createdAt: 1, _id: 1 }).toArray();
  if (LIMIT) posts = posts.slice(0, LIMIT);
  const existingCategories = await BlogCategory.find({}).lean();
  const categoriesByName = new Map(existingCategories.map((category) => [category.name.toLowerCase(), category]));
  const categoriesBySlug = new Map(existingCategories.map((category) => [category.slug, category]));

  const reservedSlugs = new Set();
  for (const post of posts) {
    if (post.slug) reservedSlugs.add(normalizeBlogSlug(post.slug));
    for (const previous of Array.isArray(post.previousSlugs) ? post.previousSlugs : []) {
      if (previous) reservedSlugs.add(normalizeBlogSlug(previous));
    }
  }
  const assignedSlugs = new Set();

  const stats = {
    inspected: posts.length,
    statusChanged: 0,
    slugChanged: 0,
    categoryLinked: 0,
    categoriesToCreate: new Set(),
    sectionsNormalized: 0,
    readingTimeBackfilled: 0,
    publishedAtBackfilled: 0,
    searchTextBackfilled: 0,
    errors: 0,
  };
  const samples = [];
  const operations = [];

  for (const post of posts) {
    try {
      const status = mappedStatus(post);
      const originalSlug = normalizeBlogSlug(post.slug);
      const reserved = new Set([...reservedSlugs, ...assignedSlugs]);
      const slug = originalSlug && !assignedSlugs.has(originalSlug)
        ? originalSlug
        : uniqueSlug(originalSlug || post.title || 'blog-post', reserved);
      assignedSlugs.add(slug);
      const content = sanitizeHtml(post.content || '');
      const excerpt = sanitizeHtml(post.excerpt || post.summary || '');
      const excerptText = clean(post.excerptText || excerpt || content, 1000);
      const sections = safeSections(post.sections);
      const readingTime = calculateReadTime([content, ...sections.map((section) => section.content)]);
      const featuredImageUrl = post.featuredImageUrl || post.imageUrl || post.coverImage || '';
      const categoryName = clean(post.category, 100);
      let category = post.categoryId
        ? existingCategories.find((item) => item._id.toString() === String(post.categoryId))
        : null;
      if (!category && categoryName) {
        category = categoriesByName.get(categoryName.toLowerCase()) || null;
        if (!category) {
          const categorySlug = normalizeBlogSlug(categoryName).slice(0, 120);
          category = categoriesBySlug.get(categorySlug) || null;
          if (!category && categorySlug) {
            stats.categoriesToCreate.add(`${categoryName} (${categorySlug})`);
          }
        }
      }

      const previousSlugs = new Set(
        (Array.isArray(post.previousSlugs) ? post.previousSlugs : [])
          .map((value) => normalizeBlogSlug(value))
          .filter((value) => value && value !== slug)
      );
      if (originalSlug && originalSlug !== slug) previousSlugs.add(originalSlug);

      const publishedAt = status === 'published'
        ? (post.publishedAt || post.date || post.createdAt || new Date())
        : post.publishedAt || null;
      const isFeatured = Boolean(post.isFeatured || post.featureOnHomePage);
      const payload = {
        title: clean(post.title || '', 500),
        slug,
        previousSlugs: Array.from(previousSlugs),
        content,
        excerpt,
        excerptText,
        summary: excerptText,
        sections,
        readingTime,
        readTime: readingTime,
        featuredImageUrl,
        featuredImageAlt: clean(post.featuredImageAlt, 300),
        imageUrl: featuredImageUrl,
        coverImage: featuredImageUrl,
        category: category ? category.name : categoryName,
        categoryId: category ? category._id : null,
        status,
        published: status === 'published',
        isFeatured,
        featureOnHomePage: isFeatured,
        publishedAt,
        date: publishedAt,
        author: clean(post.author, 200),
        therapistName: clean(post.therapistName, 200),
        therapistAvatarUrl: post.therapistAvatarUrl || '',
        tags: normalizeTags(post.tags),
        seo: post.seo || {},
        searchText: buildSearchText({ ...post, content, excerpt, excerptText, sections }),
      };

      if (status !== post.status) stats.statusChanged += 1;
      if (slug !== post.slug) stats.slugChanged += 1;
      if (category && (!post.categoryId || String(post.categoryId) !== category._id.toString())) stats.categoryLinked += 1;
      if (JSON.stringify(sections) !== JSON.stringify(post.sections || [])) stats.sectionsNormalized += 1;
      if (post.readingTime !== readingTime || post.readTime !== readingTime) stats.readingTimeBackfilled += 1;
      if (status === 'published' && !post.publishedAt) stats.publishedAtBackfilled += 1;
      if (!post.searchText) stats.searchTextBackfilled += 1;

      if (!payload.title) throw new Error('missing title');
      operations.push({ updateOne: { filter: { _id: post._id }, update: { $set: payload } } });
      if (samples.length < 12 && (
        status !== post.status ||
        slug !== post.slug ||
        !post.categoryId ||
        !post.readingTime ||
        !post.searchText
      )) {
        samples.push({ title: post.title, from: `${post.status || '(none)'} / ${post.slug || '(no slug)'}`, to: `${status} / ${slug}` });
      }
    } catch (error) {
      stats.errors += 1;
      console.error(`[blog-migrate] Could not prepare "${post.title || post._id}":`, error.message);
    }
  }

  // Handle the legacy text index before/after normalising records. A text index
  // with extra or different fields makes the new $text search behave
  // unpredictably, so only the canonical title/content/tags index is kept.
  const indexes = await collection.indexes();
  const desiredTextKeys = { title: 'text', content: 'text', tags: 'text' };
  const textIndexes = indexes.filter((index) => Object.values(index.key || {}).includes('text'));
  const compatible = textIndexes.find((index) => {
    const entries = Object.entries(index.key || {}).filter(([, value]) => value === 'text');
    return entries.length === 3 && entries.every(([key, value]) => desiredTextKeys[key] === value);
  });
  const staleTextIndexes = textIndexes.filter((index) => index !== compatible);

  console.log('\n[blog-migrate] Summary');
  console.log(`  Posts inspected:          ${stats.inspected}`);
  console.log(`  Status changes:           ${stats.statusChanged}`);
  console.log(`  Slug changes:             ${stats.slugChanged}`);
  console.log(`  Category links:           ${stats.categoryLinked}`);
  console.log(`  Categories to create:     ${stats.categoriesToCreate.size}`);
  console.log(`  Sections normalised:      ${stats.sectionsNormalized}`);
  console.log(`  Reading time backfilled:  ${stats.readingTimeBackfilled}`);
  console.log(`  Published-at backfilled:  ${stats.publishedAtBackfilled}`);
  console.log(`  Search text backfilled:   ${stats.searchTextBackfilled}`);
  console.log(`  Text indexes found:       ${textIndexes.length}`);
  console.log(`  Stale text indexes:       ${staleTextIndexes.map((index) => index.name).join(', ') || 'none'}`);
  console.log(`  Errors:                   ${stats.errors}`);
  if (stats.categoriesToCreate.size) {
    console.log(`  Category examples:        ${Array.from(stats.categoriesToCreate).slice(0, 10).join('; ')}`);
  }
  if (samples.length) {
    console.log('  Sample changes:');
    for (const sample of samples) console.log(`    - ${sample.title}: ${sample.from} -> ${sample.to}`);
  }

  if (!APPLY) {
    console.log('\n[blog-migrate] Dry run complete. Re-run with --apply to write changes.');
    return;
  }

  if (stats.errors) throw new Error('Refusing to apply with preparation errors; resolve them first.');

  for (const categoryLabel of stats.categoriesToCreate) {
    const name = categoryLabel.replace(/\s+\([^)]*\)$/, '');
    const slug = normalizeBlogSlug(name).slice(0, 120);
    if (!slug) continue;
    const category = await BlogCategory.findOneAndUpdate(
      { slug },
      { $setOnInsert: { name, slug } },
      { upsert: true, new: true }
    );
    categoriesByName.set(name.toLowerCase(), category);
    categoriesBySlug.set(slug, category);
    for (const operation of operations) {
      if (!operation.updateOne.update.$set.categoryId && operation.updateOne.update.$set.category === name) {
        operation.updateOne.update.$set.categoryId = category._id;
      }
    }
  }

  for (let i = 0; i < operations.length; i += 100) {
    await collection.bulkWrite(operations.slice(i, i + 100), { ordered: false });
  }

  for (const index of staleTextIndexes) {
    await collection.dropIndex(index.name);
    console.log(`[blog-migrate] Dropped stale text index: ${index.name}`);
  }
  if (!compatible) {
    await collection.createIndex(desiredTextKeys);
    console.log('[blog-migrate] Created canonical title/content/tags text index.');
  }

  const [remaining, published, drafts, unpublished] = await Promise.all([
    collection.countDocuments({}),
    collection.countDocuments({ status: 'published' }),
    collection.countDocuments({ status: 'draft' }),
    collection.countDocuments({ status: 'unpublished' }),
  ]);
  console.log(`\n[blog-migrate] Applied. Total ${remaining}, published ${published}, draft ${drafts}, unpublished ${unpublished}.`);
}

main()
  .catch((error) => {
    console.error('[blog-migrate] Failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
