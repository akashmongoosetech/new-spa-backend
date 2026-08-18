import mongoose from 'mongoose';

const systemAuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
    },
    module: {
      type: String,
      default: '',
    },
    details: {
      type: String,
      default: '',
    },
    user: {
      type: String,
      default: '',
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    ipAddress: {
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

systemAuditLogSchema.index({ timestamp: -1 });

export default mongoose.model('SystemAuditLog', systemAuditLogSchema);