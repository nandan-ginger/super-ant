'use strict';
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const sessionManager = require('../../chatbot/services/sessionManager');

/**
 * GET /health
 * Readiness probe — checks DB connectivity and returns system stats.
 */
router.get('/', async (req, res) => {
  // Mongoose readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  const dbOk = mongoose.connection.readyState === 1;
  const status = dbOk ? 'ok' : 'degraded';

  return res.status(dbOk ? 200 : 503).json({
    status,
    timestamp:      new Date().toISOString(),
    uptime:         Math.floor(process.uptime()),
    activeSessions: sessionManager.activeCount(),
    database:       dbOk ? 'connected' : 'disconnected',
    dbType:         'MongoDB',
  });
});

module.exports = router;
