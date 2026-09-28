import SystemAuditLog from '../models/SystemAuditLog.js';
import LoginActivity from '../models/LoginActivity.js';
import { serializeAuditLog, serializeLoginActivity } from '../utils/serializers.js';

export async function listAuditLogs(req, res) {
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '200', 10) || 200));
  const logs = await SystemAuditLog.find().sort({ timestamp: -1 }).limit(limit).lean();
  return res.json(logs.map(serializeAuditLog));
}

export async function listLoginActivities(req, res) {
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '200', 10) || 200));
  const logs = await LoginActivity.find().sort({ timestamp: -1 }).limit(limit).lean();
  return res.json(logs.map(serializeLoginActivity));
}

export default { listAuditLogs, listLoginActivities };