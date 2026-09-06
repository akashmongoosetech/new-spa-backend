import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    category: {
      type: String,
      default: '',
      trim: true,
    },
    author: {
      type: String,
      default: '',
    },
    therapistName: {
      type: String,
      default: '',
      trim: true,
    },
    therapistAvatarUrl: {
      type: String,
      default: '',
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    readTime: {
      type: Number,
      default: null,
    },
    excerpt: {
      type: String,
      default: '',
    },
    summary: {
      type: String,
      default: '',
    },
    content: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      default: '',
    },
    coverImage: {
      type: String,
      default: '',
    },
    tags: {
      type: [String],
      default: [],
    },
    published: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    featureOnHomePage: {
      type: Boolean,
      default: false,
    },
    seo: {
      metaTitle: {
        type: String,
        default: '',
        trim: true,
      },
      metaDescription: {
        type: String,
        default: '',
        trim: true,
      },
      keywords: {
        type: [String],
        default: [],
      },
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

blogSchema.index({ title: 'text', content: 'text', tags: 'text' });
blogSchema.index({ status: 1, published: 1, featureOnHomePage: 1 });
blogSchema.index({ slug: 1 });

export default mongoose.model('BlogPost', blogSchema);
