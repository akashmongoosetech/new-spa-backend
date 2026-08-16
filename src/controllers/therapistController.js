import { v4 as uuidv4 } from 'uuid';
import { TherapistModel } from '../models/TherapistModel.js';
import { BookingModel } from '../models/BookingModel.js';
import { SettingsModel } from '../models/SettingsModel.js';
import { sendError, sendSuccess, handleError } from '../utils/responseHandler.js';

export const getTherapists = (req, res) => {
  try {
    const list = TherapistModel.getAll();
    return res.json(list);
  } catch (err) {
    return handleError(res, err);
  }
};

export const getTherapistById = (req, res) => {
  try {
    const t = TherapistModel.getById(req.params.id);
    if (!t) return sendError(res, 'Therapist not found', 404);
    return res.json(t);
  } catch (err) {
    return handleError(res, err);
  }
};

export const createTherapist = (req, res) => {
  try {
    const { name, title } = req.body;
    if (!name || !title) return sendError(res, 'Name and title are required', 400);

    const id = `ther-${uuidv4().slice(0, 8)}`;
    const newT = TherapistModel.create({ ...req.body, id });
    return res.status(201).json(newT);
  } catch (err) {
    return handleError(res, err);
  }
};

export const updateTherapist = (req, res) => {
  try {
    const { id } = req.params;
    const updated = TherapistModel.update(id, req.body);
    return res.json(updated);
  } catch (err) {
    return handleError(res, err);
  }
};

export const deleteTherapist = (req, res) => {
  try {
    TherapistModel.delete(req.params.id);
    return sendSuccess(res, null, 'Therapist deleted');
  } catch (err) {
    return handleError(res, err);
  }
};

export const getAvailabilitySlots = (req, res) => {
  try {
    const { therapistId, date } = req.query;
    const allSlots = [
      "09:00 AM", "10:30 AM", "12:00 PM", "01:30 PM",
      "03:00 PM", "04:30 PM", "06:00 PM", "07:30 PM", "09:00 PM"
    ];

    // Honour schedule config: emergency closure, blocked dates, holidays.
    if (date) {
      try {
        const settings = SettingsModel.getSettings();
        const schedule = settings.scheduleConfig;
        const closed =
          schedule && (
            schedule.emergencyClosure ||
            (schedule.blockedDates || []).includes(date) ||
            (schedule.holidays || []).some((h) => h && h.date === date)
          );
        if (closed) {
          return res.json([]);
        }
      } catch (err) {
        // never block availability because settings are unreadable
      }
    }

    if (!date) {
      return res.json(allSlots);
    }

    const bookings = BookingModel.getAll();
    const booked = bookings
      .filter(b => b.date === date && b.status !== 'cancelled' && (therapistId === 'any' || b.therapistId === therapistId || b.therapistId === 'any'))
      .map(b => b.timeSlot);

    const available = allSlots.filter(slot => !booked.includes(slot));
    return res.json(available);
  } catch (err) {
    return handleError(res, err);
  }
};
