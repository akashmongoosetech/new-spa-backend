import mongoose from 'mongoose';
import { extractText, calculateReadTime } from '../utils/sanitize.js';
import { BLOG_STATUSES, buildSearchText, normalizeStatus } from '../utils/blogContent.js';

const sectionSchema = new mongoose.Schema(
  {
    id: { type: String, default: '', trim: true },
    heading: { type: String, default: '', trim: true },
    content: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const seoSchema = new mongoose.Schema(
  {
    metaTitle: { type: String, default: '', trim: true },
    metaDescription: { type: String, default: '', trim: true },
    canonicalUrl: { type: String, default: '', trim: true },
    ogTitle: { type: String, default: '', trim: true },
    ogDescription: { type: String, default: '', trim: true },
    ogImageUrl: { type: String, default: '', trim: true },
    twitterTitle: { type: String, default: '', trim: true },
    twitterDescription: { type: String, default: '', trim: true },
    twitterImageUrl: { type: String, default: '', trim: true },
    keywords: { type: [String], default: [] },
  },
  { _id: false }
);

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 160,
    },
    previousSlugs: {
      type: [String],
      default: [],
    },
    category: {
      type: String,
      default: '',
      trim: true,
      maxlength: 100,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BlogCategory',
      default: null,
    },
    author: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },
    therapistName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },
    therapistAvatarUrl: {
      type: String,
      default: '',
      trim: true,
    },
    date: {
      type: Date,
      default: null,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    readTime: {
      type: Number,
      default: 1,
      min: 1,
    },
    readingTime: {
      type: Number,
      default: 1,
      min: 1,
    },
    excerpt: {
      type: String,
      default: '',
    },
    excerptText: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    summary: {
      type: String,
      default: '',
    },
    content: {
      type: String,
      default: '',
    },
    featuredImageUrl: {
      type: String,
      default: '',
      trim: true,
    },
    featuredImageAlt: {
      type: String,
      default: '',
      trim: true,
      maxlength: 300,
    },
    imageUrl: {
      type: String,
      default: '',
      trim: true,
    },
    coverImage: {
      type: String,
      default: '',
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    published: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: BLOG_STATUSES,
      default: 'draft',
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    featureOnHomePage: {
      type: Boolean,
      default: false,
    },
    sections: {
      type: [sectionSchema],
      default: [],
    },
    seo: {
      type: seoSchema,
      default: () => ({}),
    },
    searchText: {
      type: String,
      default: '',
      select: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
    },
  },
  { timestamps: true }
);

// Keep old status values readable while normalizing them to the new public
// contract. This protects both the migration window and legacy admin clients.
blogSchema.pre('validate', function syncBlogAliases(next) {
  const legacyStatus = String(this.status || '').toLowerCase();
  if (legacyStatus === 'active' || legacyStatus === 'inactive') {
    this.status = normalizeStatus(legacyStatus, this.published ? 'published' : 'draft');
  }
  if (!BLOG_STATUSES.includes(this.status)) {
    this.status = this.published ? 'published' : 'draft';
  }

  this.published = this.status === 'published';
  this.isFeatured = Boolean(this.isFeatured || this.featureOnHomePage);
  this.featureOnHomePage = this.isFeatured;

  if (!this.featuredImageUrl) {
    this.featuredImageUrl = this.imageUrl || this.coverImage || '';
  }
  this.imageUrl = this.featuredImageUrl || this.imageUrl || '';
  this.coverImage = this.featuredImageUrl || this.coverImage || '';

  if (!this.excerpt && this.summary) this.excerpt = this.summary;
  if (!this.excerptText) {
    this.excerptText = extractText(this.excerpt || this.content).slice(0, 1000);
  }
  if (!this.summary) this.summary = this.excerptText;

  const sectionContent = (this.sections || []).map((section) => section.content);
  const words = [this.content, ...sectionContent].filter(Boolean).join(' ');
  this.readingTime = calculateReadTime(words);
  this.readTime = this.readingTime;

  if (this.status === 'published' && !this.publishedAt) {
    this.publishedAt = this.date || new Date();
  }
  if (!this.date && this.publishedAt) this.date = this.publishedAt;

  this.searchText = buildSearchText(this);
  next();
});

blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ category: 1, status: 1, publishedAt: -1 });
blogSchema.index({ isFeatured: 1, status: 1, publishedAt: -1 });
blogSchema.index({ previousSlugs: 1 });
blogSchema.index({ title: 'text', content: 'text', tags: 'text' });

export default mongoose.model('BlogPost', blogSchema);
