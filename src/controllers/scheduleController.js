import ScheduleConfig from '../models/ScheduleConfig.js';
import { serializeScheduleConfig } from '../utils/serializers.js';
import { logAudit } from '../services/auditService.js';

export async function getSchedule(req, res) {
  let doc = await ScheduleConfig.findOne({ key: 'default' });
  if (!doc) doc = await ScheduleConfig.create({ key: 'default' });
  return res.json(serializeScheduleConfig(doc.toObject()));
}

export async function updateSchedule(req, res) {
  let doc = await ScheduleConfig.findOne({ key: 'default' });
  if (!doc) doc = new ScheduleConfig({ key: 'default' });

  const b = req.body || {};
  if (b.blockedDates !== undefined) doc.blockedDates = b.blockedDates;
  if (b.holidays !== undefined) doc.holidays = b.holidays;
  if (b.emergencyClosure !== undefined) doc.emergencyClosure = Boolean(b.emergencyClosure);
  if (b.emergencyClosureReason !== undefined) doc.emergencyClosureReason = b.emergencyClosureReason;
  if (b.timeSlots !== undefined) doc.timeSlots = b.timeSlots;
  if (b.workingHoursStart !== undefined) doc.workingHoursStart = b.workingHoursStart;
  if (b.workingHoursEnd !== undefined) doc.workingHoursEnd = b.workingHoursEnd;

  await doc.save();
  await logAudit({ action: 'update', module: 'schedule', details: 'Updated schedule configuration', req });
  return res.json(serializeScheduleConfig(doc.toObject()));
}

export default { getSchedule, updateSchedule };