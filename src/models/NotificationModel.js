import { query, queryOne, run } from '../config/db.js';

export class NotificationModel {
  static getAll() {
    return query('SELECT * FROM notifications ORDER BY created_at DESC');
  }

  static getUnreadCount() {
    const res = queryOne('SELECT COUNT(*) as cnt FROM notifications WHERE is_read = 0');
    return res ? res.cnt : 0;
  }

  static markRead(id) {
    run('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    return true;
  }

  static markAllRead() {
    run('UPDATE notifications SET is_read = 1');
    return true;
  }

  static delete(id) {
    run('DELETE FROM notifications WHERE id = ?', [id]);
    return true;
  }
}
