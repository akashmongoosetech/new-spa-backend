import Notification from '../models/Notification.js';

function visibleTo(userId) {
  if (!userId) return { recipientId: null };
  return { $or: [{ recipientId: null }, { recipientId: userId }] };
}

function isUnreadFilter(userId) {
  return {
    $and: [
      visibleTo(userId),
      { readBy: { $ne: userId } },
      // Legacy rows have no readBy and rely on the global isRead flag.
      // Rows with a non-empty readBy are unread for anyone not in the list.
      {
        $or: [
          { readBy: { $exists: false }, isRead: false },
          { readBy: { $size: 0 }, isRead: false },
          { readBy: { $exists: true, $not: { $size: 0 } } },
        ],
      },
    ],
  };
}

function readState(doc, userId) {
  const readBy = Array.isArray(doc.readBy) ? doc.readBy : [];
  if (readBy.length > 0) {
    return readBy.some((id) => String(id) === String(userId));
  }
  return Boolean(doc.isRead);
}

export async function createNotification({
  type = 'info',
  title,
  message = '',
  link = '',
  createdBy = null,
  recipientId = null,
}) {
  try {
    return await Notification.create({ type, title, message, link, createdBy, recipientId });
  } catch (err) {
    console.error('[notifications] create failed:', err.message);
    return null;
  }
}

export async function listNotifications({ userId = null, limit = 50 } = {}) {
  const docs = await Notification.find(visibleTo(userId))
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const unreadCount = await Notification.countDocuments(isUnreadFilter(userId));
  return {
    docs: docs.map((doc) => ({ ...doc, isRead: readState(doc, userId) })),
    unreadCount,
  };
}

export async function markRead(id, userId) {
  const res = await Notification.updateOne(
    { _id: id, ...visibleTo(userId) },
    { $addToSet: { readBy: userId } }
  );
  return { matched: res.matchedCount > 0 };
}

export async function markAllRead(userId) {
  const res = await Notification.updateMany(
    isUnreadFilter(userId),
    { $addToSet: { readBy: userId } }
  );
  return { modifiedCount: res.modifiedCount };
}

export async function deleteNotification(id, userId) {
  await Notification.deleteOne({ _id: id, ...visibleTo(userId) });
  return true;
}

export default { createNotification, listNotifications, markRead, markAllRead, deleteNotification };
