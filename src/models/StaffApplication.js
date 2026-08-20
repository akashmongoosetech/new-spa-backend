import mongoose from 'mongoose';

const staffApplicationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    requestedRole: {
      type: String,
      enum: ['Admin', 'Manager', 'Receptionist'],
      default: 'Receptionist',
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    note: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    reviewNote: {
      type: String,
      default: '',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model('StaffApplication', staffApplicationSchema);