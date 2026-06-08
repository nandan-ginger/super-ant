'use strict';
const express = require('express');
const router = express.Router();
const { testConnection } = require('../database/connection');
const sessionManager = require('../services/sessionManager');

/**
 * GET /health
 * Readiness probe — checks DB connectivity and returns system stats.
 */
router.get('/', async (req, res) => {
  const dbOk = await testConnection().catch(() => false);
  const status = dbOk ? 'ok' : 'degraded';

  return res.status(dbOk ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    activeSessions: sessionManager.activeCount(),
    database: dbOk ? 'connected' : 'disconnected',
  });
});

module.exports = router;
