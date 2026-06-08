'use strict';
const express = require('express');
const router = express.Router();
const { listLeads, countLeads } = require('../database/queries/leads');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Middleware: require LEADS_API_KEY in Authorization header.
 * Header format: Authorization: Bearer <key>
 */
function requireApiKey(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const key = auth.replace(/^Bearer\s+/i, '').trim();
  if (!key || key !== config.leadsApiKey) {
    logger.warn('Leads API: unauthorized access attempt', { ip: req.ip });
    return res.status(401).json({ error: 'Unauthorized. Provide a valid API key.' });
  }
  next();
}

/**
 * GET /api/leads
 *
 * Returns paginated list of captured leads.
 *
 * Query params:
 *   limit   (default 100, max 500)
 *   offset  (default 0)
 *   intent  filter by intent category
 */
router.get('/', requireApiKey, async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = parseInt(req.query.offset, 10) || 0;
    const intent = req.query.intent || undefined;

    const [leads, total] = await Promise.all([
      listLeads({ limit, offset, intent }),
      countLeads(intent),
    ]);

    return res.json({ total, limit, offset, leads });
  } catch (err) {
    logger.error('GET /api/leads error', { error: err.message });
    return res.status(500).json({ error: 'Failed to retrieve leads.' });
  }
});

module.exports = router;
