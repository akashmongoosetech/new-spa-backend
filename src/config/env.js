import dotenv from 'dotenv';
import path from 'path';
import dns from 'dns';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load backend/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Node's c-ares resolver can be misconfigured on some machines (e.g. pointed
// at a loopback DNS that nothing listens on), which breaks SRV lookups for
// mongodb+srv:// URIs. When DNS_SERVERS is set, point Node's resolver at it.
const dnsServers = (process.env.DNS_SERVERS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (dnsServers.length > 0) {
  try {
    dns.setServers(dnsServers);
  } catch {
    // Ignore invalid overrides; fall back to the OS default resolver.
  }
}

function required(name, fallback) {
  const value = process.env[name];
  if (!value || (typeof fallback === 'string' && value.trim() === '')) {
    if (fallback === undefined) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return fallback;
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',

  port: parseInt(process.env.PORT || '3000', 10),

  mongodbUri: required('MONGODB_URI'),

  dnsServers,

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  resetTokenExpiresIn: process.env.RESET_TOKEN_EXPIRES_IN || '1h',

  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || process.env.SMTP_USER || '',
    fromName: process.env.MAIL_FROM_NAME || 'Tripod Wellness',
  },

  adminEmail: process.env.ADMIN_EMAIL || '',

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  },

  uploadPublicUrl: (process.env.UPLOAD_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, ''),
  maxUploadSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '5', 10),
};

export default env;
