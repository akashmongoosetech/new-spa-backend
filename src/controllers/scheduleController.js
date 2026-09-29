import ScheduleConfig from '../models/ScheduleConfig.js';
import { serializeScheduleConfig } from '../utils/serializers.js';
import { HttpError } from '../utils/api.js';
import { logAudit } from '../services/auditService.js';

export async function getSchedule(req, res) {
  let doc = await ScheduleConfig.findOne({ key: 'default' });
  if (!doc) doc = await ScheduleConfig.create({ key: 'default' });
  return res.json(serializeScheduleConfig(doc.toObject()));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export async function updateSchedule(req, res) {
  let doc = await ScheduleConfig.findOne({ key: 'default' });
  if (!doc) doc = new ScheduleConfig({ key: 'default' });

  const b = req.body || {};
  if (b.blockedDates !== undefined) {
    if (!Array.isArray(b.blockedDates)) throw new HttpError(400, 'Invalid blockedDates');
    const clean = [...new Set(b.blockedDates.map(String))].filter((d) => DATE_RE.test(d)).slice(0, 365);
    doc.blockedDates = clean;
  }
  if (b.holidays !== undefined) {
    if (!Array.isArray(b.holidays)) throw new HttpError(400, 'Invalid holidays');
    const seen = new Set();
    doc.holidays = b.holidays.filter((h) => h && DATE_RE.test(String(h.date))).filter((h) => {
      if (seen.has(h.date)) return false;
      seen.add(h.date);
      return true;
    }).slice(0, 100).map((h) => ({ date: String(h.date), name: String(h.name || '').slice(0, 120) }));
  }
  if (b.emergencyClosure !== undefined) doc.emergencyClosure = Boolean(b.emergencyClosure);
  if (b.emergencyClosureReason !== undefined) doc.emergencyClosureReason = String(b.emergencyClosureReason).slice(0, 500);
  if (b.timeSlots !== undefined) {
    if (!Array.isArray(b.timeSlots)) throw new HttpError(400, 'Invalid timeSlots');
    doc.timeSlots = [...new Set(b.timeSlots.map(String))].filter((t) => HHMM_RE.test(t)).slice(0, 48);
  }
  if (b.workingHoursStart !== undefined) {
    if (!HHMM_RE.test(String(b.workingHoursStart))) throw new HttpError(400, 'Invalid workingHoursStart');
    doc.workingHoursStart = b.workingHoursStart;
  }
  if (b.workingHoursEnd !== undefined) {
    if (!HHMM_RE.test(String(b.workingHoursEnd))) throw new HttpError(400, 'Invalid workingHoursEnd');
    doc.workingHoursEnd = b.workingHoursEnd;
  }
  const s = doc.workingHoursStart || '00:00';
  const e = doc.workingHoursEnd || '23:59';
  // Round-the-clock days are expressed as 00:00–23:59 (start of day to end
  // of day). Anything else still requires opening before closing.
  if (s >= e) throw new HttpError(400, 'Opening time must be before closing time (use 00:00 – 23:59 for 24 hours)');

  await doc.save();
  await logAudit({ action: 'update', module: 'schedule', details: 'Updated schedule configuration', req });
  return res.json(serializeScheduleConfig(doc.toObject()));
}

export default { getSchedule, updateSchedule };