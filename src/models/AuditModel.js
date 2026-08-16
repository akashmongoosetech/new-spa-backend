import { v4 as uuidv4 } from 'uuid';
import { query, run } from '../config/db.js';

export class AuditModel {
  static getAuditLogs() {
    return query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100');
  }

  static getLoginActivities() {
    return query('SELECT * FROM login_activities ORDER BY created_at DESC LIMIT 100');
  }

  static getEmailLogs() {
    return query('SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 100');
  }

  static logAudit(user, action, details, ip) {
    const id = `aud-${uuidv4().slice(0, 8)}`;
    run('INSERT INTO audit_logs (id, user, action, details, ip_address) VALUES (?, ?, ?, ?, ?)', [
      id, user || 'System', action, details || null, ip || '127.0.0.1'
    ]);
  }

  static logLoginActivity(email, status, ip, userAgent) {
    const id = `log-${uuidv4().slice(0, 8)}`;
    run('INSERT INTO login_activities (id, user_email, status, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)', [
      id, email, status, ip || '127.0.0.1', userAgent || 'Unknown Browser'
    ]);
  }
}
