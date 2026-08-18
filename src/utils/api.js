/**
 * Small HTTP helpers that mirror the exact error/response contract the
 * frontend reads in frontend/src/services/api.ts:
 *   - success/plain data are returned RAW (never wrapped in {success, data})
 *   - errors are `{ success:false, error, message }` (frontend reads data.error || data.message)
 */

import env from '../config/env.js';

export function sendError(res, status, message, extra = {}) {
  return res.status(status).json({
    success: false,
    error: message,
    message,
    ...extra,
  });
}

export function sendSuccess(res, status, payload) {
  return res.status(status).json(payload);
}

/**
 * Central error class so controllers can throw typed failures that the global
 * error middleware maps to the right HTTP code.
 */
export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.extra = extra;
  }
}

export function notFoundHandler(req, res) {
  return sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
}

export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return sendError(res, err.status, err.message, err.extra);
  }

  // Mongoose validation / duplicate key errors
  if (err.name === 'ValidationError') {
    const first = Object.values(err.errors || {})[0];
    return sendError(res, 400, first ? first.message : 'Validation failed');
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return sendError(res, 400, `${field || 'Field'} already exists`);
  }
  if (err.name === 'CastError') {
    return sendError(res, 400, `Invalid ${err.path}`);
  }
  if (err.name === 'MulterError') {
    return sendError(res, 400, err.message);
  }
  if (err.type === 'entity.too.large') {
    return sendError(res, 413, 'Request payload too large');
  }
  if (err.type === 'entity.parse.failed') {
    return sendError(res, 400, 'Invalid JSON payload');
  }

  console.error('[error] Unhandled error:', err);
  if (env.isProduction) {
    return sendError(res, 500, 'Internal server error');
  }
  return sendError(res, 500, err.message || 'Internal server error');
}

export default { HttpError, sendError, sendSuccess, notFoundHandler, errorHandler };