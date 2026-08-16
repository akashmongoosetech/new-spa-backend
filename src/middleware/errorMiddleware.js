import { sendError } from '../utils/responseHandler.js';

export function errorHandler(err, req, res, next) {
  console.error('Unhandled Error:', err.stack || err.message || err);

  const message = err.message || 'An unexpected internal server error occurred.';
  const statusCode = err.statusCode || 500;
  return sendError(res, message, statusCode);
}
