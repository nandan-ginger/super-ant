'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '.env') });

/**
 * Centralised configuration loader.
 * All env vars with defaults are defined here.
 * The rest of the app imports from this module — never process.env directly.
 */
const config = {
  // Server
  port:    parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Gemini AI
  geminiApiKey:        process.env.GEMINI_API_KEY || '',
  geminiChatModel:     process.env.GEMINI_CHAT_MODEL || 'gemini-2.0-flash',
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-exp-03-07',
  geminiLiveModelTTS:  process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview',

  // MongoDB
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ginger_copilot',
  },

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Session TTL (minutes)
  sessionTtlMinutes: parseInt(process.env.SESSION_TTL_MINUTES, 10) || 30,

  // RAG token thresholds
  rag: {
    directLimit: parseInt(process.env.RAG_DIRECT_LIMIT, 10) || 5000,
    chunkLimit:  parseInt(process.env.RAG_CHUNK_LIMIT, 10)  || 50000,
    topK:        parseInt(process.env.RAG_TOP_K, 10)        || 5,
  },

  // Admin Auth
  jwtSecret: process.env.JWT_SECRET || 'changeme_jwt_secret_32_chars_min',
  jwtExpiry: process.env.JWT_EXPIRY || '7d',

  // Server base URL (used to build widget embed script)
  serverBaseUrl: (process.env.SERVER_BASE_URL || 'http://localhost:3001').replace(/\/$/, ''),

  // Initial SuperAdmin credentials (only used to seed on first startup)
  superAdmin: {
    username: process.env.SUPER_ADMIN_USERNAME || 'superadmin',
    email:    process.env.SUPER_ADMIN_EMAIL    || 'admin@example.com',
    password: process.env.SUPER_ADMIN_PASSWORD || 'changeme_superadmin_password',
  },

  // Review Agent Config
  reviewAgent: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
      accountId: process.env.GOOGLE_ACCOUNT_ID || '',
      locationId: process.env.GOOGLE_LOCATION_ID || '',
    },
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.EMAIL_FROM || 'noreply@gingerconsultancy.com',
    },
    emails: {
      support: process.env.EMAIL_SUPPORT || '',
      admin: process.env.EMAIL_ADMIN || '',
    },
    pollCron: process.env.REVIEW_POLL_CRON || '*/5 * * * *',
  },
};

module.exports = config;

// Validate critical config at startup
if (!config.geminiApiKey) {
  console.warn('[CONFIG] WARNING: GEMINI_API_KEY is not set. AI features will not work.');
} else {
  const logger = require('../utils/logger');
  const masked = (typeof config.geminiApiKey === 'string' && config.geminiApiKey.length > 8)
    ? `${config.geminiApiKey.slice(0, 4)}...${config.geminiApiKey.slice(-4)}`
    : '[REDACTED]';
  logger.info('[CONFIG] GEMINI_API_KEY loaded from .env', { maskedKey: masked });
}

