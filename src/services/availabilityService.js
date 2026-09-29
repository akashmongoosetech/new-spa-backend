import Booking from '../models/Booking.js';
import ScheduleConfig from '../models/ScheduleConfig.js';
import Therapist from '../models/Therapist.js';
import Setting from '../models/Setting.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function pad(n) {
  return String(n).padStart(2, '0');
}

function dayOfWeek(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDay();
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toMinutes(t) {
  const m = String(t || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function generateSlots(start, end, intervalMin) {
  const s = toMinutes(start);
  const e = toMinutes(end);
  const step = Number(intervalMin) > 0 ? Number(intervalMin) : 60;
  if (s === null || e === null || e <= s) return [];
  const slots = [];
  let cur = s;
  while (cur < e) {
    slots.push(`${pad(Math.floor(cur / 60))}:${pad(cur % 60)}`);
    cur += step;
  }
  return slots;
}

async function getConfig() {
  const c = await ScheduleConfig.findOne({ key: 'default' }).lean();
  return c || { blockedDates: [], holidays: [], timeSlots: [], workingHoursStart: '00:00', workingHoursEnd: '23:59' };
}

async function getSettings() {
  const s = await Setting.findOne({ key: 'default' }).lean();
  return s || { maxBookingsPerSlot: 3, slotIntervalMinutes: 60 };
}

function isBlocked(config, dateStr) {
  if (config.emergencyClosure) return true;
  if ((config.blockedDates || []).includes(dateStr)) return true;
  if ((config.holidays || []).some((h) => h.date === dateStr)) return true;
  return false;
}

/**
 * Compute free time slots for a date.
 * Returns a plain array of "HH:MM" strings, exactly as the frontend expects.
 *
 * @param {string} dateStr  e.g. '2026-08-20'
 * @param {string} therapistId  ObjectId or the literal 'any'
 */
export async function getAvailableSlots(dateStr, therapistId = 'any') {
  if (!DATE_RE.test(String(dateStr || ''))) return [];
  // Reject past dates outright (today handled with time filtering below).
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  if (String(dateStr) < todayStr) return [];

  const config = await getConfig();

  if (isBlocked(config, dateStr)) {
    return [];
  }

  const settings = await getSettings();
  const interval = settings.slotIntervalMinutes || 60;

  // 1) Base slot list: explicit timeSlots config, else generate from hours.
  let baseSlots = (config.timeSlots || []).slice();
  if (baseSlots.length === 0) {
    baseSlots = generateSlots(
      config.workingHoursStart || '00:00',
      config.workingHoursEnd || '23:59',
      interval
    );
  }

  // 2) Therapist-specific filtering.
  if (therapistId && therapistId !== 'any') {
    let therapist = null;
    try { therapist = await Therapist.findById(therapistId).lean(); } catch { therapist = null; }
    if (!therapist || therapist.active === false) {
      return [];
    }
    const av = therapist.availability || {};
    const days = (av.days && av.days.length ? av.days : therapist.availableDays || []);
    const dow = dayOfWeek(dateStr);
    if (dow === null) return [];
    const weekday = WEEKDAYS[dow];
    if (days.length && !days.includes(weekday)) {
      return [];
    }
    const therapistSlots = (av.timeSlots && av.timeSlots.length ? av.timeSlots : av.slots || []);
    if (therapistSlots.length) {
      baseSlots = baseSlots.filter((s) => therapistSlots.includes(s));
    }
  }

  // 3) Capacity check — count ALL active bookings for the slot date/time
  // regardless of therapist partition, so 'any' and specific bookings share capacity.
  const maxPerSlot = settings.maxBookingsPerSlot || 3;
  const taken = await Booking.find({
    date: dateStr,
    status: { $nin: ['cancelled', 'rejected'] },
  })
    .select('timeSlot therapistId')
    .lean();

  const counts = {};
  for (const b of taken) {
    counts[b.timeSlot] = (counts[b.timeSlot] || 0) + 1;
  }

  // 4) Drop past slots on today (local time, consistent with todayStr above).
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const free = baseSlots.filter((slot) => {
    if ((counts[slot] || 0) >= maxPerSlot) return false;
    if (dateStr === todayStr) {
      const [hh, mm] = slot.split(':').map(Number);
      if (hh * 60 + mm <= nowMin) return false;
    }
    return true;
  });

  return free;
}

export default { getAvailableSlots };