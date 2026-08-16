import { v4 as uuidv4 } from 'uuid';
import { run } from '../config/db.js';

export function createNotification(title, message, type = 'info', link) {
  const id = `notif-${uuidv4().slice(0, 8)}`;
  run(
    'INSERT INTO notifications (id, title, message, type, is_read, link) VALUES (?, ?, ?, ?, 0, ?)',
    [id, title, message, type, link || null]
  );
  return id;
}
