import { NotificationModel } from '../models/NotificationModel.js';
import { sendError, sendSuccess, handleError } from '../utils/responseHandler.js';

export const getNotifications = (req, res) => {
  try {
    const notifications = NotificationModel.getAll();
    const unreadCount = NotificationModel.getUnreadCount();
    return res.json({ notifications, unreadCount });
  } catch (err) {
    return handleError(res, err);
  }
};

export const markNotificationRead = (req, res) => {
  try {
    NotificationModel.markRead(req.params.id);
    return sendSuccess(res, null, 'Notification marked as read');
  } catch (err) {
    return handleError(res, err);
  }
};

export const markAllNotificationsRead = (req, res) => {
  try {
    NotificationModel.markAllRead();
    return sendSuccess(res, null, 'All notifications marked as read');
  } catch (err) {
    return handleError(res, err);
  }
};

export const deleteNotification = (req, res) => {
  try {
    NotificationModel.delete(req.params.id);
    return sendSuccess(res, null, 'Notification deleted');
  } catch (err) {
    return handleError(res, err);
  }
};
