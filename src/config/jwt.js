import crypto from 'crypto';

// Never ship a hardcoded secret. In production JWT_SECRET must be set; in dev a
// random per-boot secret is generated (sessions invalidate on restart, which is
// acceptable locally and avoids a predictable signing key).
const devSecret = crypto.randomBytes(64).toString('hex');

export const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || devSecret,
  expiresIn: process.env.JWT_EXPIRES_IN || '7d'
};

if (!process.env.JWT_SECRET) {
  console.warn('[jwt] JWT_SECRET is not set — using a random per-boot secret. Set JWT_SECRET in production.');
}
