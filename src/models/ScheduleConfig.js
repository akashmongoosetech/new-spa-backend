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
    workingHoursStart: {
      type: String,
      default: '09:00',
    },
    workingHoursEnd: {
      type: String,
      default: '22:00',
    },
  },
  { timestamps: true }
);

export default mongoose.model('ScheduleConfig', scheduleConfigSchema);