import SystemAuditLog from '../models/SystemAuditLog.js';

function ipOf(req) {
  if (!req) return '';
  const raw = req.ip || req.headers['x-forwarded-for'] || '';
  return raw.toString().split(',')[0].trim();
}

/**
 * Write an audit log entry. Best-effort; never throws.
 */
export async function logAudit({ action, module = '', details = '', req = null, userId = null, userName = '' }) {
  try {
    await SystemAuditLog.create({
      action,
      module,
      details,
      userId: userId || (req && req.user ? req.user._id : null),
      user: userName || (req && req.user ? req.user.name : 'System'),
      ipAddress: ipOf(req),
    });
  } catch (err) {
    console.error('[audit] failed:', err.message);
  }
  return true;
}

export async function listAuditLogs({ limit = 200 } = {}) {
  return SystemAuditLog.find().sort({ timestamp: -1 }).limit(limit).lean();
}

export default { logAudit, listAuditLogs };