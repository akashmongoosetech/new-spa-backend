import slugify from 'slugify';
import env from '../config/env.js';
import { extractText } from './sanitize.js';

export const BLOG_STATUSES = ['draft', 'published', 'unpublished'];
export const MAX_TITLE_LENGTH = 500;
export const MAX_SLUG_LENGTH = 160;
export const MAX_EXCERPT_TEXT = 1000;
export const MAX_META_TITLE = 60;
export const MAX_META_DESCRIPTION = 160;
export const MAX_SECTIONS = 100;

export function normalizeBlogSlug(value) {
  return slugify(String(value || ''), {
    lower: true,
    strict: true,
    trim: true,
  }).slice(0, MAX_SLUG_LENGTH).replace(/^-+|-+$/g, '');
}

export function normalizeStatus(value, fallback = 'draft') {
  const status = String(value || '').toLowerCase().trim();
  if (BLOG_STATUSES.includes(status)) return status;
  // Backward compatibility for records created by the previous admin UI.
  if (status === 'active') return fallback === 'draft' ? 'draft' : 'published';
  if (status === 'inactive') return 'unpublished';
  return fallback;
}

export function normalizeBoolean(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'on';
}

export function normalizeStringList(value, { maxItems = 30, maxLength = 60 } = {}) {
  const list = Array.isArray(value)
    ? value
    : String(value || '').split(',');
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const item = String(raw || '').replace(/^#/, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function normalizeTags(value) {
  return normalizeStringList(value, { maxItems: 30, maxLength: 50 });
}

export function normalizeKeywords(value) {
  return normalizeStringList(value, { maxItems: 30, maxLength: 60 });
}

export function buildSearchText(post) {
  const sections = Array.isArray(post.sections) ? post.sections : [];
  return [
    post.title,
    post.excerptText || extractText(post.excerpt),
    extractText(post.content),
    ...sections.flatMap((section) => [section.heading, extractText(section.content)]),
    ...(Array.isArray(post.tags) ? post.tags : []),
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120000);
}

export function isAbsoluteHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Image fields accept absolute HTTPS URLs. Relative site paths are also
 * supported for approved local assets; data:, javascript: and file: are not.
 */
export function normalizeImageUrl(value, { allowRelative = true } = {}) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (allowRelative && /^\/(?!\/)/.test(raw)) return raw;
  if (!isAbsoluteHttpUrl(raw)) return '';
  const url = new URL(raw);
  if (env.isProduction && url.protocol !== 'https:') return '';
  return url.toString();
}

export function allowedCanonicalHosts() {
  const hosts = new Set();
  try {
    hosts.add(new URL(env.siteUrl).hostname.toLowerCase());
  } catch {
    // Ignore invalid configured site URL; it is validated by the environment.
  }
  for (const host of env.blogCanonicalHosts) {
    hosts.add(String(host || '').trim().toLowerCase());
  }
  return hosts;
}

export function normalizeCanonicalUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && !(env.isDevelopment && url.protocol === 'http:')) return '';
    if (url.username || url.password) return '';
    if (!allowedCanonicalHosts().has(url.hostname.toLowerCase())) return '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

export function toAbsoluteAssetUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^\/(?!\/)/.test(raw)) return `${env.siteUrl}${raw}`;
  return '';
}

export function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function clampText(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > Math.floor(maxLength * 0.6) ? cut.slice(0, lastSpace) : cut).trim();
}

export default {
  BLOG_STATUSES,
  MAX_TITLE_LENGTH,
  MAX_SLUG_LENGTH,
  MAX_EXCERPT_TEXT,
  MAX_META_TITLE,
  MAX_META_DESCRIPTION,
  MAX_SECTIONS,
  normalizeBlogSlug,
  normalizeStatus,
  normalizeBoolean,
  normalizeStringList,
  normalizeTags,
  normalizeKeywords,
  buildSearchText,
  isAbsoluteHttpUrl,
  normalizeImageUrl,
  allowedCanonicalHosts,
  normalizeCanonicalUrl,
  toAbsoluteAssetUrl,
  escapeRegExp,
  clampText,
};
