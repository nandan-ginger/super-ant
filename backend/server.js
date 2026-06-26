'use strict';
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server: SocketIOServer } = require('socket.io');

const config = require('./common/config');
const logger = require('./common/utils/logger');
const { connectDB, disconnectDB } = require('./common/database/connection');
const { attachChatHandlers } = require('./chatbot');
const { seedSuperAdmin } = require('./common/queries/adminUsers');

// ─── Express App Setup ────────────────────────────────────────────────────────
const app = express();

// Trust proxy headers (for logging real IPs when behind nginx/load balancer)
app.set('trust proxy', 1);

// CORS — allow widget to connect from any customer website
app.use(cors({
  origin: config.corsOrigin === '*' ? '*' : config.corsOrigin.split(',').map(s => s.trim()),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
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

// Serve the test client page (useful for testing & deployment demo)
const testDir = path.join(__dirname, '..', 'test');
app.use('/test', express.static(testDir));
app.get('/', (req, res) => {
  res.sendFile(path.join(testDir, 'index.html'));
});

// Serve the admin dashboard
const adminDistDir = path.join(__dirname, '..', 'frontend', 'admin', 'dist');
app.use('/admin', express.static(adminDistDir));
app.get('/admin*', (req, res) => {
  res.sendFile(path.join(adminDistDir, 'index.html'));
});

// Common routes
app.use('/health',          require('./common/routes/health'));
app.use('/api/auth',        require('./common/routes/auth'));

// Chatbot product routes
app.use('/api',             require('./chatbot').router);

// Review Agent product routes
app.use('/api/review-agent', require('./review-agent').router);


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

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  logger.info('Starting Ginger LiveChat AI Copilot backend...');

  // Validate Gemini API key
  if (!config.geminiApiKey) {
    logger.warn('GEMINI_API_KEY is not configured — AI features will fail at runtime');
  }

  // Connect to MongoDB
  const dbReady = await connectDB();
  if (!dbReady) {
    logger.error('Cannot connect to MongoDB. Please ensure the database is running.');
    logger.error(`Connection URI: ${config.mongodb.uri}`);
    process.exit(1);
  }

  // Seed superadmin (only if no superadmin exists yet)
  try {
    const seeded = await seedSuperAdmin(config.superAdmin);
    if (seeded) {
      logger.info(`SuperAdmin seeded: ${seeded.username} (${seeded.email})`);
      logger.warn('IMPORTANT: Change the SUPER_ADMIN_PASSWORD in .env before going to production!');
    }
  } catch (err) {
    logger.error('SuperAdmin seed failed', { error: err.message });
  }

  // Start review polling job
  try {
    const { startReviewPolling } = require('./review-agent');
    startReviewPolling();
  } catch (err) {
    logger.error('Failed to start review polling cron job', { error: err.message });
  }

  // Start listening
  server.listen(config.port, () => {
    logger.info(`🚀 Server running on http://localhost:${config.port}`);
    logger.info(`📡 Socket.IO ready`);
    logger.info(`🔌 Widget served at http://localhost:${config.port}/livechat/index.js`);
    logger.info(`❤️  Health: http://localhost:${config.port}/health`);
    logger.info(`🍃 Database: MongoDB`);
    logger.info(`Environment: ${config.nodeEnv}`);
  });
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info(`Received ${signal} — shutting down gracefully...`);
  server.close(async () => {
    try {
      const { stopReviewPolling } = require('./review-agent');
      stopReviewPolling();
    } catch (err) {
      logger.error('Error stopping review polling job during shutdown', { error: err.message });
    }
    await disconnectDB();
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
