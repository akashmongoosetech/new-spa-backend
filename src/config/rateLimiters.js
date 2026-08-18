import rateLimit from 'express-rate-limit';

// Shared helper to build a JSON-friendly rate limit handler.
function limiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: message,
        message,
      });
    },
  });
}

export const authLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many attempts. Please try again later.',
});

export const passwordResetLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many password reset requests. Please try again later.',
});

export const contactLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'Too many messages from this address. Please try again later.',
});

export const newsletterLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many subscription attempts. Please try again later.',
});

export const couponLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  max: 60,
  message: 'Too many coupon attempts. Please try again later.',
});

export const bookingLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'Too many booking requests. Please try again later.',
});

export const uploadLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: 'Too many uploads. Please try again later.',
});
