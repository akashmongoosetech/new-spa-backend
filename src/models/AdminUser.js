import mongoose from 'mongoose';

const adminUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['Super Admin', 'Admin', 'Manager', 'Receptionist'],
      default: 'Admin',
    },
    phone: {
      type: String,
      default: '',
    },
    avatarUrl: {
      type: String,
      default: '',
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
    username: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    city: {
      type: String,
      default: '',
      trim: true,
    },
    state: {
      type: String,
      default: '',
      trim: true,
    },
    country: {
      type: String,
      default: '',
      trim: true,
    },
    pincode: {
      type: String,
      default: '',
      trim: true,
    },
    dob: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: ['', 'Male', 'Female', 'Other'],
      default: '',
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    lastLoginIp: {
      type: String,
      default: '',
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockoutUntil: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model('AdminUser', adminUserSchema);
