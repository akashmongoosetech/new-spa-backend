import mongoose from 'mongoose';

const emailLogSchema = new mongoose.Schema(
  {
    to: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['booking_confirmation', 'contact_thankyou', 'newsletter_welcome', 'booking_status_update', 'booking_reminder'],
      default: 'booking_confirmation',
    },
    htmlContent: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['sent', 'failed'],
      default: 'sent',
    },
    error: {
      type: String,
      default: '',
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model('EmailLog', emailLogSchema);
