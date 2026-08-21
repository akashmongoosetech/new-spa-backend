import jwt from 'jsonwebtoken';
import AdminUser from '../models/AdminUser.js';
import env from '../config/env.js';
import { HttpError, sendError } from '../utils/api.js';

/**
 * JWT authentication middleware.
 * Reads the Bearer token from the Authorization header, verifies it, loads the
 * user from the DB (so deactivated/deleted users are rejected immediately),
 * and attaches req.user.
 *
 * A 401 here makes the frontend clear its local auth state and redirect.
 */
export async function protect(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return sendError(res, 401, 'Not authorized — missing token');
  }

  const token = header.slice(7).trim();
  if (!token) {
    return sendError(res, 401, 'Not authorized — missing token');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch {
    return sendError(res, 401, 'Session expired or invalid — please sign in again');
  }

  const user = await AdminUser.findById(decoded.id).select('-password');
  if (!user) {
    return sendError(res, 401, 'Account not found');
  }
  if (user.active === false) {
    return sendError(res, 401, 'Account is deactivated');
  }
  // Token version invalidation: password changes bump tokenVersion, killing old sessions.
  if ((decoded.v || 0) !== (user.tokenVersion || 0)) {
    return sendError(res, 401, 'Session expired — please sign in again');
  }

  req.user = user;
  return next();
}

/**
 * Role guard. Uses the canonical role names the frontend expects:
 *   'Super Admin', 'Admin', 'Manager', 'Receptionist'
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Not authorized');
    }
    if (!roles.includes(req.user.role)) {
      return sendError(res, 403, 'You do not have permission to perform this action');
    }
    return next();
  };
}

export const ROLES = ['Super Admin', 'Admin', 'Manager', 'Receptionist'];

export default { protect, authorize, ROLES };