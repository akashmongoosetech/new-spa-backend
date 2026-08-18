import mongoose from 'mongoose';

const testimonialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      default: '',
      trim: true,
    },
    rating: {
      type: Number,
      default: 5,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
    },
    serviceTitle: {
      type: String,
      default: '',
    },
    date: {
      type: Date,
      default: Date.now,
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    approved: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Testimonial', testimonialSchema);
