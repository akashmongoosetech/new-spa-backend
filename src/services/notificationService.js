import Notification from '../models/Notification.js';

export async function createNotification({ type = 'info', title, message = '', link = '', createdBy = null }) {
  try {
    return await Notification.create({ type, title, message, link, createdBy });
  } catch (err) {
    console.error('[notifications] create failed:', err.message);
    return null;
  }
}

export async function listNotifications({ limit = 50 } = {}) {
  const docs = await Notification.find().sort({ createdAt: -1 }).limit(limit);
  const unreadCount = await Notification.countDocuments({ isRead: false });
  return { docs, unreadCount };
}

export async function markRead(id) {
  await Notification.updateOne({ _id: id }, { $set: { isRead: true } });
  return true;
}

export async function markAllRead() {
  const res = await Notification.updateMany({ isRead: false }, { $set: { isRead: true } });
  return { modifiedCount: res.modifiedCount };
}

export async function deleteNotification(id) {
  await Notification.findByIdAndDelete(id);
  return true;
}

export default { createNotification, listNotifications, markRead, markAllRead, deleteNotification };