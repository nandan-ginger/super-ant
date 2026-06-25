'use strict';
const express = require('express');
const router = express.Router();
const logger = require('../../common/utils/logger');
const { requireAuth, requirePermission } = require('../../common/middleware/adminAuth');
const { listSessionsByWidget, countSessionsByWidget } = require('../queries/sessions');
const { getMessages } = require('../queries/messages');

/**
 * GET /api/livechats
 *
 * List all chat sessions for a specific widget (website).
 * Admin must have livechats.view permission.
 *
 * Query params:
 *   widgetCode  (required) — filter by widget
 *   limit       (default 50, max 200)
 *   offset      (default 0)
 */
router.get('/', requireAuth, requirePermission('livechats', 'view'), async (req, res) => {
  const { widgetCode } = req.query;

  if (!widgetCode) {
    return res.status(400).json({ error: 'widgetCode query parameter is required.' });
  }

  try {
    const limit  = Math.min(parseInt(req.query.limit,  10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;

    const [sessions, total] = await Promise.all([
      listSessionsByWidget(widgetCode, { limit, offset }),
      countSessionsByWidget(widgetCode),
    ]);

    // Enrich with display name
    const enriched = sessions.map(s => ({
      ...s,
      display_name: s.visitor_name || `Visitor #${s.id.slice(0, 8)}`,
      has_lead: !!s.lead_id,
    }));

    return res.json({ total, limit, offset, widgetCode, sessions: enriched });
  } catch (err) {
    logger.error('GET /api/livechats error', { error: err.message });
    return res.status(500).json({ error: 'Failed to retrieve live chat sessions.' });
  }
});

/**
 * GET /api/livechats/:sessionId/messages
 *
 * Get the full chat message history for a session.
 * Admin must have livechats.view permission.
 *
 * Query params:
 *   limit  (default 200, max 1000)
 */
router.get('/:sessionId/messages', requireAuth, requirePermission('livechats', 'view'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
    const messages = await getMessages(req.params.sessionId, limit);

    return res.json({
      sessionId: req.params.sessionId,
      count: messages.length,
      messages,
    });
  } catch (err) {
    logger.error('GET /api/livechats/:sessionId/messages error', { error: err.message });
    return res.status(500).json({ error: 'Failed to retrieve messages.' });
  }
});

module.exports = router;
