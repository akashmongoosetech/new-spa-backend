import jwt from 'jsonwebtoken';
import env from '../config/env.js';

/**
 * Sign a JWT with only the claims needed by the middleware.
 * Password reset tokens are purpose-scoped so they can never act as sessions.
 */
export function generateToken(user, options = {}) {
  return jwt.sign(
    { id: user._id ? user._id.toString() : user.id, role: user.role, v: user.tokenVersion || 0 },
    env.jwtSecret,
    { expiresIn: options.expiresIn || env.jwtExpiresIn }
  );
}

export function generateResetToken(payload) {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.resetTokenExpiresIn,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

export default generateToken;