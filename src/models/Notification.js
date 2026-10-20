import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['booking', 'contact', 'cancellation', 'newsletter', 'login', 'security', 'info'],
      default: 'info',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      default: '',
    },
    // Legacy/global flag. New notifications track reads per staff member in
    // `readBy` so one admin marking an item read does not hide it for others.
    isRead: {
      type: Boolean,
      default: false,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdminUser',
      },
    ],
    // null = visible to all staff. Set this for personal security notices.
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    link: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ isRead: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
