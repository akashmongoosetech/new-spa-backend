import { getAdminStats } from '../services/statsService.js';

export async function adminStats(req, res) {
  const stats = await getAdminStats();
  return res.json(stats);
}

export default { adminStats };