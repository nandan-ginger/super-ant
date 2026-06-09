'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

/**
 * Centralised configuration loader.
 * All env vars with defaults are defined here.
 * The rest of the app imports from this module — never process.env directly.
 */
const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Gemini AI
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiChatModel: process.env.GEMINI_CHAT_MODEL || 'gemini-2.0-flash',
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-exp-03-07',
  geminiLiveModelTTS: process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview',
  // PostgreSQL
  pg: {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT, 10) || 5432,
    database: process.env.PG_DATABASE || 'ginger_copilot',
    user: process.env.PG_USER || 'ginger',
    password: process.env.PG_PASSWORD || 'ginger_dev',
  },

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Session TTL (minutes)
  sessionTtlMinutes: parseInt(process.env.SESSION_TTL_MINUTES, 10) || 30,

  // RAG token thresholds
  rag: {
    directLimit: parseInt(process.env.RAG_DIRECT_LIMIT, 10) || 5000,
    chunkLimit: parseInt(process.env.RAG_CHUNK_LIMIT, 10) || 50000,
    topK: parseInt(process.env.RAG_TOP_K, 10) || 5,
  },

  // Leads API protection key
  leadsApiKey: process.env.LEADS_API_KEY || 'changeme_secret_key',
};

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

module.exports = config;
