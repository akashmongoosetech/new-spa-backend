import { serializeNotification } from '../utils/serializers.js';
import {
  listNotifications,
  markRead,
  markAllRead,
  deleteNotification,
} from '../services/notificationService.js';
import { HttpError } from '../utils/api.js';

export async function getNotifications(req, res) {
  const { docs, unreadCount } = await listNotifications({ limit: 100 });
  return res.json({
    notifications: docs.map(serializeNotification),
    unreadCount,
  });
}

export async function markNotificationRead(req, res) {
  await markRead(req.params.id);
  return res.json({ success: true });
}

export async function markAllNotificationsRead(req, res) {
  const { modifiedCount } = await markAllRead();
  return res.json({ success: true, modifiedCount });
}

export async function deleteNotificationItem(req, res) {
  await deleteNotification(req.params.id);
  return res.json({ success: true });
}

export default { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotificationItem, HttpError };