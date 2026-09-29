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
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  },

  llm: {
    provider: process.env.LLM_PROVIDER || 'gemini',
    model: process.env.LLM_MODEL || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    apiKey: process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || '',
    maxOutputTokens: parseInt(process.env.CHAT_MAX_OUTPUT_TOKENS || '500', 10) || 500,
    sseTimeoutMs: parseInt(process.env.CHAT_SSE_TIMEOUT_MS || '45000', 10) || 45000,
  },

  embeddings: {
    provider: process.env.EMBEDDING_PROVIDER || 'gemini',
    model: process.env.EMBEDDING_MODEL || 'gemini-embedding-001',
  },

  rag: {
    vectorProvider: process.env.VECTOR_DB_PROVIDER || 'atlas',
    topK: parseInt(process.env.RAG_TOP_K || '5', 10) || 5,
    similarityThreshold: parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || '0.72') || 0.72,
    chunkSize: parseInt(process.env.RAG_CHUNK_SIZE || '500', 10) || 500,
    chunkOverlap: parseInt(process.env.RAG_CHUNK_OVERLAP || '80', 10) || 80,
  },

  uploadPublicUrl: (process.env.UPLOAD_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, ''),
  maxUploadSizeMb: (() => {
    const n = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '5', 10);
    return Number.isFinite(n) && n > 0 && n <= 50 ? n : 5;
  })(),
};

export default env;
