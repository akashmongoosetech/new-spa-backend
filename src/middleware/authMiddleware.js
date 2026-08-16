import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/jwt.js';
import { sendError } from '../utils/responseHandler.js';

export function authenticateJwt(req, res, next) {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return sendError(res, 'Authentication token missing. Access denied.', 401);
  }

  try {
    const decoded = jwt.verify(token, JWT_CONFIG.secret);
    req.user = decoded;
    next();
  } catch (err) {
    return sendError(res, 'Invalid or expired token.', 401);
  }
}
