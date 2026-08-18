import mongoose from 'mongoose';
import { sendError } from '../utils/api.js';

/**
 * Validates :id route params that must be MongoDB ObjectIds.
 */
export function validateObjectId(paramName = 'id') {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (value && !mongoose.Types.ObjectId.isValid(value)) {
      return sendError(res, 400, `Invalid ${paramName}`);
    }
    return next();
  };
}

export default validateObjectId;