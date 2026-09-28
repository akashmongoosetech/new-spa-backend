import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    discount: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator(v) {
          if (this.discountType === 'percent') return v >= 0 && v <= 100;
          return v >= 0;
        },
        message: 'Percent discount must be between 0 and 100',
      },
    },
    discountType: {
      type: String,
      enum: ['fixed', 'percent'],
      default: 'fixed',
    },
    minAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxUses: {
      type: Number,
      default: 100,
      min: 1,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Coupon', couponSchema);
