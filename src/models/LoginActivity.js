import mongoose from 'mongoose';

const loginActivitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    userName: {
      type: String,
      default: '',
    },
    userEmail: {
      type: String,
      default: '',
    },
    email: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      default: 'success',
    },
    deviceInfo: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

loginActivitySchema.index({ timestamp: -1 });

export default mongoose.model('LoginActivity', loginActivitySchema);