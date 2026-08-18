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

function generateSlots(start, end, intervalMin) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const slots = [];
  let cur = sh * 60 + sm;
  const last = eh * 60 + em;
  while (cur < last) {
    slots.push(`${pad(Math.floor(cur / 60))}:${pad(cur % 60)}`);
    cur += intervalMin;
  }
  return slots;
}

async function getConfig() {
  const c = await ScheduleConfig.findOne({ key: 'default' }).lean();
  return c || { blockedDates: [], holidays: [], timeSlots: [], workingHoursStart: '09:00', workingHoursEnd: '22:00' };
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
      config.workingHoursStart || '09:00',
      config.workingHoursEnd || '22:00',
      interval
    );
  }

  // 2) Therapist-specific filtering.
  if (therapistId && therapistId !== 'any') {
    const therapist = await Therapist.findById(therapistId).lean();
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

  // 3) Capacity check.
  const maxPerSlot = settings.maxBookingsPerSlot || 3;
  const matchTherapist = therapistId === 'any' ? { therapistId: 'any' } : { therapistId: String(therapistId) };
  const taken = await Booking.find({
    date: dateStr,
    status: { $nin: ['cancelled', 'rejected'] },
    ...matchTherapist,
  })
    .select('timeSlot')
    .lean();

  const counts = {};
  for (const b of taken) {
    counts[b.timeSlot] = (counts[b.timeSlot] || 0) + 1;
  }

  // 4) Drop past slots on today.
  const todayStr = new Date().toISOString().slice(0, 10);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

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