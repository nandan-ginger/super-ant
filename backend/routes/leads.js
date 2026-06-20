'use strict';
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { requireAuth, requirePermission } = require('../middleware/adminAuth');
const { listLeads, countLeads, getLeadById } = require('../database/queries/leads');

/**
 * GET /api/leads
 *
 * Returns paginated list of captured leads.
 * Requires admin auth + leads.view permission.
 *
 * Query params:
 *   limit       (default 100, max 500)
 *   offset      (default 0)
 *   intent      filter by intent category
 *   widgetCode  filter by registered website
 */
router.get('/', requireAuth, requirePermission('leads', 'view'), async (req, res) => {
  try {
    const limit      = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset     = parseInt(req.query.offset, 10) || 0;
    const intent     = req.query.intent     || undefined;
    const widgetCode = req.query.widgetCode || undefined;

    const [leads, total] = await Promise.all([
      listLeads({ limit, offset, intent, widgetCode }),
      countLeads(intent, widgetCode),
    ]);

    return res.json({ total, limit, offset, leads });
  } catch (err) {
    logger.error('GET /api/leads error', { error: err.message });
    return res.status(500).json({ error: 'Failed to retrieve leads.' });
  }
});

/**
 * GET /api/leads/:id
 *
 * Get a single lead by UUID.
 * Requires admin auth + leads.view permission.
 */
router.get('/:id', requireAuth, requirePermission('leads', 'view'), async (req, res) => {
  try {
    const lead = await getLeadById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found.' });
    }
    return res.json({ lead });
  } catch (err) {
    logger.error('GET /api/leads/:id error', { error: err.message });
    return res.status(500).json({ error: 'Failed to retrieve lead.' });
  }
});

module.exports = router;
