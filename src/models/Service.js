import mongoose from 'mongoose';

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, trim: true },
    answer: { type: String, trim: true },
  },
  { _id: false }
);

const serviceSchema = new mongoose.Schema(
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
      trim: true,
      lowercase: true,
    },
    category: {
      type: String,
      default: '',
      trim: true,
    },
    shortDescription: {
      type: String,
      default: '',
    },
    fullDescription: {
      type: String,
      default: '',
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    originalPrice: {
      type: Number,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: 60,
      min: 1,
    },
    benefits: {
      type: [String],
      default: [],
    },
    includedItems: {
      type: [String],
      default: [],
    },
    imageUrl: {
      type: String,
      default: '',
    },
    featured: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    faq: {
      type: [faqSchema],
      default: [],
    },
  },
  { timestamps: true }
);

serviceSchema.index({ title: 'text', category: 'text', shortDescription: 'text' });

export default mongoose.model('Service', serviceSchema);
