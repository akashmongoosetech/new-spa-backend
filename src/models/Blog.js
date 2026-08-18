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
  },
  { timestamps: true }
);

blogSchema.index({ title: 'text', content: 'text', tags: 'text' });

export default mongoose.model('BlogPost', blogSchema);
