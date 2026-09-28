import cors from 'cors';
import env from './env.js';

// Auth is a Bearer token in the Authorization header (no cookies are issued,
// so there is no CSRF surface). withCredentials is still sent by the frontend,
// so allow the configured frontend origin(s) only — never "*" for these APIs.
const allowedOrigins = env.clientUrl
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Allow same-origin / non-browser requests (curl, smoke tests, Postman)
    if (!origin) return callback(null, true);
    const normalized = String(origin).trim().replace(/\/$/, '');
    if (allowedOrigins.includes(normalized)) {
      return callback(null, true);
    }
    const err = new Error('Not allowed by CORS');
    err.status = 403;
    return callback(err);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  maxAge: 86400,
};

export default cors(corsOptions);
