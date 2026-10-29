import { z } from 'zod';
import { HttpError } from './api.js';

const urlLike = z.string().trim().max(2000).optional().default('');
const shortText = (max) => z.string().trim().max(max).optional().default('');

const sectionSchema = z.object({
  id: z.string().trim().max(80).optional().default(''),
  heading: z.string().trim().max(300).optional().default(''),
  content: z.string().max(200000).optional().default(''),
  order: z.coerce.number().int().min(0).max(1000).optional(),
});

const seoSchema = z.object({
  metaTitle: z.string().trim().max(60).optional().default(''),
  metaDescription: z.string().trim().max(160).optional().default(''),
  canonicalUrl: z.string().trim().max(500).optional().default(''),
  ogTitle: z.string().trim().max(70).optional().default(''),
  ogDescription: z.string().trim().max(200).optional().default(''),
  ogImageUrl: urlLike,
  twitterTitle: z.string().trim().max(70).optional().default(''),
  twitterDescription: z.string().trim().max(200).optional().default(''),
  twitterImageUrl: urlLike,
  keywords: z.array(z.string().trim().max(60)).max(30).optional().default([]),
});

export const blogInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(500, 'Title must be 500 characters or fewer'),
  slug: z.string().trim().max(160).refine((value) => value === '' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), 'Slug may only contain lowercase letters, numbers and hyphens').optional().default(''),
  excerpt: z.string().max(50000).optional().default(''),
  content: z.string().max(500000).optional().default(''),
  featuredImageUrl: urlLike,
  featuredImageAlt: z.string().trim().max(300).optional().default(''),
  category: z.string().trim().max(100).optional().default(''),
  categoryId: z.string().trim().refine((value) => value === '' || /^[a-f0-9]{24}$/i.test(value), 'Invalid category id').optional().default(''),
  author: z.string().trim().max(200).optional().default(''),
  therapistName: z.string().trim().max(200).optional().default(''),
  therapistAvatarUrl: urlLike,
  tags: z.array(z.string().trim().max(50)).max(30).optional().default([]),
  status: z.enum(['draft', 'published', 'unpublished']).optional().default('draft'),
  isFeatured: z.boolean().optional().default(false),
  sections: z.array(sectionSchema).max(100).optional().default([]),
  seo: seoSchema.optional().default({}),
  expectedUpdatedAt: z.string().trim().max(40).optional().default(''),
  publishedAt: z.string().trim().max(40).optional().default(''),
});

export const blogStatusSchema = z.object({
  status: z.enum(['draft', 'published', 'unpublished']),
});

export const blogFeaturedSchema = z.object({
  isFeatured: z.boolean(),
});

export const blogCategoryInputSchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100),
  slug: z.string().trim().max(120).optional().default(''),
  description: shortText(500),
});

export function parseBlogInput(data) {
  const result = blogInputSchema.safeParse(data);
  if (!result.success) {
    throw new HttpError(400, 'Please correct the highlighted blog fields.', {
      issues: result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return result.data;
}

export function parseCategoryInput(data) {
  const result = blogCategoryInputSchema.safeParse(data);
  if (!result.success) {
    throw new HttpError(400, 'Please correct the category fields.', {
      issues: result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return result.data;
}

export default {
  blogInputSchema,
  blogStatusSchema,
  blogFeaturedSchema,
  blogCategoryInputSchema,
  parseBlogInput,
  parseCategoryInput,
};
