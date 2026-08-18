import { getAvailableSlots } from '../services/availabilityService.js';
import { HttpError } from '../utils/api.js';

export async function getAvailability(req, res) {
  const { date, therapistId } = req.query;
  if (!date) throw new HttpError(400, 'date query parameter is required');

  const slots = await getAvailableSlots(String(date), therapistId ? String(therapistId) : 'any');
  return res.json(slots);
}

export default { getAvailability };