import env from '../config/env.js';
import {
  clampText,
  normalizeCanonicalUrl,
  normalizeImageUrl,
  toAbsoluteAssetUrl,
} from './blogContent.js';
import { extractText } from './sanitize.js';

const DEFAULT_OG_PATH = process.env.DEFAULT_OG_IMAGE || '/brand/og-default.jpg';
const SITE_NAME = process.env.PUBLIC_SITE_NAME || 'Tripod Wellness';

function clean(value, max) {
  return clampText(String(value || '').replace(/\s+/g, ' '), max);
}

export function defaultCanonicalForSlug(slug, siteUrl = env.siteUrl) {
  return `${String(siteUrl || env.siteUrl).replace(/\/+$/, '')}/blog/${encodeURIComponent(slug)}/`;
}

function withBlogTrailingSlash(value) {
  try {
    const url = new URL(value);
    if (!/\.[a-z0-9]{2,8}$/i.test(url.pathname) && !url.pathname.endsWith('/')) {
      url.pathname = `${url.pathname}/`;
    }
    return url.toString();
  } catch {
    return value;
  }
}

export function resolveBlogSeo(post = {}) {
  const seo = post.seo && typeof post.seo === 'object' ? post.seo : {};
  const title = clean(post.title, 500);
  const isPublished =
    (post.status === 'published' || (post.status === 'active' && post.published)) &&
    post.published !== false &&
    post.published !== 0;
  const metaTitle = clean(seo.metaTitle, 60) || clampText(title, 60);
  const descriptionSource =
    clean(seo.metaDescription, 160) ||
    clean(post.excerptText, 160) ||
    clean(extractText(post.excerpt), 160) ||
    clean(extractText(post.content), 160);
  const canonical = withBlogTrailingSlash(
    normalizeCanonicalUrl(seo.canonicalUrl) ||
    defaultCanonicalForSlug(post.slug || '', env.siteUrl)
  );
  const absoluteImage = (value) => {
    const normalized = normalizeImageUrl(value);
    if (!normalized) return '';
    return /^\/(?!\/)/.test(normalized) ? toAbsoluteAssetUrl(normalized) : normalized;
  };
  const featuredImage = absoluteImage(post.featuredImageUrl || post.imageUrl || post.coverImage || '');
  const ogImage =
    absoluteImage(seo.ogImageUrl) ||
    featuredImage ||
    toAbsoluteAssetUrl(DEFAULT_OG_PATH);
  const twitterImage = absoluteImage(seo.twitterImageUrl) || ogImage;
  const imageAlt = clean(post.featuredImageAlt, 300) || title;

  return {
    title: metaTitle,
    description: descriptionSource,
    canonicalUrl: canonical,
    robots: isPublished ? 'index, follow' : 'noindex, nofollow',
    type: 'article',
    ogTitle: clean(seo.ogTitle, 70) || metaTitle || title,
    ogDescription: clean(seo.ogDescription, 200) || descriptionSource,
    ogImageUrl: ogImage,
    ogImageAlt: imageAlt,
    twitterTitle: clean(seo.twitterTitle, 70) || clean(seo.ogTitle, 70) || metaTitle || title,
    twitterDescription:
      clean(seo.twitterDescription, 200) ||
      clean(seo.ogDescription, 200) ||
      descriptionSource,
    twitterImageUrl: twitterImage,
    twitterCard: twitterImage ? 'summary_large_image' : 'summary',
    keywords: Array.isArray(seo.keywords) ? seo.keywords : [],
    section: clean(post.category, 100),
    author: clean(post.author, 200),
    publishedAt: post.publishedAt || post.date || null,
    updatedAt: post.updatedAt || null,
  };
}

function isoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function buildBlogPostingJsonLd(post = {}, resolved = resolveBlogSeo(post)) {
  const isPublished =
    (post.status === 'published' || (post.status === 'active' && post.published)) &&
    post.published !== false &&
    post.published !== 0;
  if (!isPublished) return null;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: resolved.title || post.title,
    description: resolved.description,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': resolved.canonicalUrl,
    },
    url: resolved.canonicalUrl,
    image: [resolved.ogImageUrl].filter(Boolean),
  };

  const datePublished = isoOrNull(resolved.publishedAt);
  const dateModified = isoOrNull(resolved.updatedAt);
  if (datePublished) data.datePublished = datePublished;
  if (dateModified) data.dateModified = dateModified;
  if (resolved.author) data.author = { '@type': 'Person', name: resolved.author };
  if (resolved.section) data.articleSection = resolved.section;
  if (resolved.keywords?.length) data.keywords = resolved.keywords.join(', ');
  if (SITE_NAME) data.publisher = { '@type': 'Organization', name: SITE_NAME };

  return data;
}

export default { resolveBlogSeo, buildBlogPostingJsonLd, defaultCanonicalForSlug };
