'use strict';
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { requireAuth, requirePermission } = require('../middleware/adminAuth');
const { listSessionsByWidget, countSessionsByWidget, getSessionWithLeadInfo } = require('../database/queries/sessions');

/**
 * GET /api/visitors
 *
 * List all visitors (sessions) for a specific widget.
 * Visitors who submitted the lead form appear with their name.
 * Anonymous visitors appear as "Visitor #<short-id>".
 *
 * Query params:
 *   widgetCode  (required)
 *   limit       (default 50, max 200)
 *   offset      (default 0)
 */
router.get('/', requireAuth, requirePermission('visitors', 'view'), async (req, res) => {
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

    const visitors = sessions.map(s => ({
      session_id:    s.id,
      widget_code:   s.widget_code,
      display_name:  s.visitor_name || `Visitor #${s.id.slice(0, 8)}`,
      email:         s.visitor_email || null,
      phone:         s.visitor_phone || null,
      has_lead:      !!s.lead_id,
      lead_id:       s.lead_id || null,
      page_url:      s.page_url,
      page_title:    s.page_title,
      started_at:    s.started_at,
      last_active:   s.last_active,
      message_count: s.message_count,
    }));

    return res.json({ total, limit, offset, widgetCode, visitors });
  } catch (err) {
    logger.error('GET /api/visitors error', { error: err.message });
    return res.status(500).json({ error: 'Failed to retrieve visitors.' });
  }
});

/**
 * GET /api/visitors/:sessionId
 *
 * Get full detail for a single visitor session:
 * - Session metadata
 * - Lead info (if submitted)
 * - Message count
 *
 * Note: Messages are fetched separately via GET /api/livechats/:sessionId/messages
 */
router.get('/:sessionId', requireAuth, requirePermission('visitors', 'view'), async (req, res) => {
  try {
    const session = await getSessionWithLeadInfo(req.params.sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    return res.json({
      visitor: {
        session_id:          session.id,
        widget_code:         session.widget_code,
        display_name:        session.visitor_name || `Visitor #${session.id.slice(0, 8)}`,
        email:               session.visitor_email || null,
        phone:               session.visitor_phone || null,
        requirement:         session.visitor_requirement || null,
        intent:              session.visitor_intent || null,
        has_lead:            !!session.lead_id,
        lead_id:             session.lead_id || null,
        lead_captured_at:    session.lead_captured_at || null,
        page_url:            session.page_url,
        page_title:          session.page_title,
        started_at:          session.started_at,
        last_active:         session.last_active,
        message_count:       session.message_count,
      },
    });
  } catch (err) {
    logger.error('GET /api/visitors/:sessionId error', { error: err.message });
    return res.status(500).json({ error: 'Failed to retrieve visitor detail.' });
  }
});

module.exports = router;
