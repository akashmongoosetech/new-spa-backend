import { sendError } from '../utils/responseHandler.js';

export function notFound(req, res, next) {
  return sendError(res, `Route not found: ${req.originalUrl}`, 404);
}
