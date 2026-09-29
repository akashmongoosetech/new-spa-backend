import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, trim: true },
    name: { type: String, default: '' },
  },
  { _id: false }
);

const scheduleConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'default',
      unique: true,
    },
    blockedDates: {
      type: [String],
      default: [],
    },
    holidays: {
      type: [holidaySchema],
      default: [],
    },
    emergencyClosure: {
      type: Boolean,
      default: false,
    },
    emergencyClosureReason: {
      type: String,
      default: '',
    },
    timeSlots: {
      type: [String],
      default: [],
    },
    // Round-the-clock default: every hour of every open day is bookable.
    workingHoursStart: {
      type: String,
      default: '00:00',
    },
    workingHoursEnd: {
      type: String,
      default: '23:59',
    },
  },
  { timestamps: true }
);

export default mongoose.model('ScheduleConfig', scheduleConfigSchema);