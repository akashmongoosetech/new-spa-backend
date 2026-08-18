import SystemAuditLog from '../models/SystemAuditLog.js';
import LoginActivity from '../models/LoginActivity.js';
import { serializeAuditLog, serializeLoginActivity } from '../utils/serializers.js';

export async function listAuditLogs(req, res) {
  const logs = await SystemAuditLog.find().sort({ timestamp: -1 }).limit(500).lean();
  return res.json(logs.map(serializeAuditLog));
}

export async function listLoginActivities(req, res) {
  const logs = await LoginActivity.find().sort({ timestamp: -1 }).limit(500).lean();
  return res.json(logs.map(serializeLoginActivity));
}

export default { listAuditLogs, listLoginActivities };