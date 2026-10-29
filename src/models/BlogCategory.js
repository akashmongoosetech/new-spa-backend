import mongoose from 'mongoose';
import { normalizeBlogSlug } from '../utils/blogContent.js';

const blogCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
    },
  },
  { timestamps: true }
);

blogCategorySchema.pre('validate', function normalizeCategory(next) {
  this.name = String(this.name || '').replace(/\s+/g, ' ').trim();
  this.slug = normalizeBlogSlug(this.slug || this.name).slice(0, 120);
  next();
});

blogCategorySchema.index({ name: 1 });

export default mongoose.model('BlogCategory', blogCategorySchema);
