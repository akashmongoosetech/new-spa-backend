import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    bookingNumber: {
      type: String,
      unique: true,
      trim: true,
    },
    customerName: {
      type: String,
      trim: true,
    },
    firstName: {
      type: String,
      default: '',
      trim: true,
    },
    lastName: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    age: {
      type: Number,
      default: null,
    },
    gender: {
      type: String,
      default: '',
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      default: null,
    },
    serviceTitle: {
      type: String,
      default: '',
    },
    servicePrice: {
      type: Number,
      default: 0,
    },
    therapistId: {
      type: String,
      default: 'any',
    },
    therapistName: {
      type: String,
      default: '',
    },
    date: {
      type: String,
      required: true,
      trim: true,
    },
    timeSlot: {
      type: String,
      required: true,
      trim: true,
    },
    durationMinutes: {
      type: Number,
      default: 60,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    couponCode: {
      type: String,
      default: '',
      uppercase: true,
      trim: true,
    },
    notes: {
      type: String,
      default: '',
    },
    paymentMethod: {
      type: String,
      enum: ['pay_at_venue', 'credit_card', 'upi', 'paypal'],
      default: 'pay_at_venue',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'refunded'],
      default: 'pending',
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled', 'rejected'],
      default: 'pending',
    },
    reminderSentAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledReason: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

bookingSchema.index({ email: 1, phone: 1 });
bookingSchema.index({ date: 1, timeSlot: 1, therapistId: 1 });
bookingSchema.index({ status: 1 });

export default mongoose.model('Booking', bookingSchema);
