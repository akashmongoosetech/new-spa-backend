import mongoose from 'mongoose';

const availabilitySchema = new mongoose.Schema(
  {
    days: {
      type: [String],
      default: [],
    },
    slots: {
      type: [String],
      default: [],
    },
    timeSlots: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const therapistSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      default: 'Massage Therapist',
      trim: true,
    },
    experienceYears: {
      type: Number,
      default: 5,
      min: 0,
    },
    bio: {
      type: String,
      default: '',
    },
    specialties: {
      type: [String],
      default: [],
    },
    imageUrl: {
      type: String,
      default: '',
    },
    photoUrl: {
      type: String,
      default: '',
    },
    gallery: {
      type: [String],
      default: [],
    },
    featured: {
      type: Boolean,
      default: false,
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
    availableDays: {
      type: [String],
      default: [],
    },
    availability: {
      type: availabilitySchema,
      default: () => ({}),
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Therapist', therapistSchema);
