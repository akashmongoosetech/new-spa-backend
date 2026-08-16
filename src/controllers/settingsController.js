import { SettingsModel } from '../models/SettingsModel.js';
import { sendError, handleError } from '../utils/responseHandler.js';

export const getSettings = (req, res) => {
  try {
    const settings = SettingsModel.getSettings();
    return res.json(settings);
  } catch (err) {
    return handleError(res, err);
  }
};

export const updateSettings = (req, res) => {
  try {
    const updated = SettingsModel.updateSettings(req.body);
    return res.json(updated);
  } catch (err) {
    return handleError(res, err);
  }
};
