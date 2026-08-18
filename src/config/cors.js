import cors from 'cors';
import env from './env.js';

// The frontend sends cookies (withCredentials) AND a Bearer token.
// Allow the configured frontend origin(s) only — never "*" for authenticated APIs.
const allowedOrigins = env.clientUrl
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Allow same-origin / non-browser requests (curl, smoke tests, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  maxAge: 86400,
};

export default cors(corsOptions);
