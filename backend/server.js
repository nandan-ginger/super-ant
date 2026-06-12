'use strict';
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server: SocketIOServer } = require('socket.io');
const fs = require('fs');

const config = require('./config');
const logger = require('./utils/logger');
const { testConnection, closePool } = require('./database/connection');
const { query } = require('./database/connection');
const { attachChatHandlers } = require('./sockets/chatHandler');

// ─── Express App Setup ────────────────────────────────────────────────────────
const app = express();

// Trust proxy headers (for logging real IPs when behind nginx/load balancer)
app.set('trust proxy', 1);

// CORS — allow widget to connect from any customer website
app.use(cors({
  origin: config.corsOrigin === '*' ? '*' : config.corsOrigin.split(',').map(s => s.trim()),
  methods: ['GET', 'POST'],
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Static Widget Files ──────────────────────────────────────────────────────
// Serve the frontend widget JS files so they can be loaded by host websites
const widgetDir = path.join(__dirname, '..', 'frontend', 'widget');
app.use('/livechat', express.static(widgetDir, {
  setHeaders: (res) => {
    // Allow any origin to load the widget script
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5-minute cache
  },
}));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/health',     require('./routes/health'));
app.use('/api/chat',   require('./routes/chat'));
app.use('/api/leads',  require('./routes/leads'));

// Catch-all 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled express error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ─── HTTP Server + Socket.IO ──────────────────────────────────────────────────
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  // Allow widget to pass sessionId as a query param
  allowRequest: (req, callback) => callback(null, true),
});

// Attach chat handlers to every new socket connection
io.on('connection', (socket) => {
  attachChatHandlers(socket);
});

// ─── Database Migration ───────────────────────────────────────────────────────
async function runMigrations() {
  const migrationPath = path.join(__dirname, 'database', 'migrations', '001_init.sql');
  try {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await query(sql);
    logger.info('Database migrations applied successfully');
  } catch (err) {
    // Ignore "already exists" errors (idempotent migrations)
    if (err.message.includes('already exists')) {
      logger.debug('Migration: tables already exist, skipping');
    } else {
      logger.error('Migration failed', { error: err.message });
      throw err;
    }
  }
}

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  logger.info('Starting Ginger LiveChat AI Copilot backend...');

  // Validate Gemini API key
  if (!config.geminiApiKey) {
    logger.warn('GEMINI_API_KEY is not configured — AI features will fail at runtime');
  }

  // Connect to PostgreSQL
  const dbReady = await testConnection();
  if (!dbReady) {
    logger.error('Cannot connect to PostgreSQL. Please ensure the database is running.');
    const connInfo = config.pg.connectionString
      ? 'Connection String (masked)'
      : `${config.pg.user}@${config.pg.host}:${config.pg.port}/${config.pg.database}`;
    logger.error(`Connection: ${connInfo}`);
    process.exit(1);
  }

  // Run DB migrations
  await runMigrations();

  // Start listening
  server.listen(config.port, () => {
    logger.info(`🚀 Server running on http://localhost:${config.port}`);
    logger.info(`📡 Socket.IO ready`);
    logger.info(`🔌 Widget served at http://localhost:${config.port}/livechat/index.js`);
    logger.info(`❤️  Health: http://localhost:${config.port}/health`);
    logger.info(`Environment: ${config.nodeEnv}`);
  });
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info(`Received ${signal} — shutting down gracefully...`);
  server.close(async () => {
    await closePool();
    logger.info('Server closed. Goodbye.');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});

start();
