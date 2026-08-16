import { AuditModel } from '../models/AuditModel.js';
import { sendError, handleError } from '../utils/responseHandler.js';

export const getAuditLogs = (req, res) => {
  try {
    const logs = AuditModel.getAuditLogs();
    return res.json(logs);
  } catch (err) {
    return handleError(res, err);
  }
};

export const getLoginActivities = (req, res) => {
  try {
    const activities = AuditModel.getLoginActivities();
    return res.json(activities);
  } catch (err) {
    return handleError(res, err);
  }
};

export const getEmailLogs = (req, res) => {
  try {
    const logs = AuditModel.getEmailLogs();
    return res.json(logs);
  } catch (err) {
    return handleError(res, err);
  }
};
