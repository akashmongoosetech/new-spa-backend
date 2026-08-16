// Lightweight in-memory rate limiter (per IP). Sufficient for a single-process
// deployment; replace with a shared store (Redis) if scaled horizontally.
const buckets = new Map();

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}

/**
 * @param {object} opts
 * @param {number} opts.windowMs - sliding window in ms
 * @param {number} opts.max - max requests per window
 * @param {string} [opts.message]
 */
export function rateLimit({ windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests. Please try again later.' } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const key = `${req.method}:${req.originalUrl}:${ip}`;
    const now = Date.now();

    let entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }

    entry.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));

    if (entry.count > max) {
      return res.status(429).json({
        success: false,
        message,
        errors: null
      });
    }

    if (buckets.size > 5000) cleanup();
    next();
  };
}
