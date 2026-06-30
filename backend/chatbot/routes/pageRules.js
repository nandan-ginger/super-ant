'use strict';
const express = require('express');
const router  = express.Router();
const logger  = require('../../common/utils/logger');
const { requireAuth, requirePermission } = require('../../common/middleware/adminAuth');
const {
  createPageRule,
  getPageRulesByWidget,
  updatePageRule,
  deletePageRule,
} = require('../queries/pageRules');

/**
 * Page Rules API
 * All routes require authentication (admin only).
 *
 * GET  /api/page-rules?widgetCode=xxx  — list rules for a widget
 * POST /api/page-rules                 — create a rule
 * PUT  /api/page-rules/:id             — update a rule
 * DELETE /api/page-rules/:id           — delete a rule
 *
 * The public widget config endpoint lives in widgets.js:
 *   GET /api/widgets/:widgetCode/config
 */

/**
 * GET /api/page-rules?widgetCode=xxx
 * List all page rules for the given widget.
 */
router.get('/', requireAuth, requirePermission('widgets', 'view'), async (req, res) => {
  const { widgetCode } = req.query;
  if (!widgetCode) {
    return res.status(400).json({ error: 'widgetCode query parameter is required.' });
  }
  try {
    const rules = await getPageRulesByWidget(widgetCode);
    return res.json({ rules });
  } catch (err) {
    logger.error('GET /api/page-rules error', { error: err.message });
    return res.status(500).json({ error: 'Failed to retrieve page rules.' });
  }
});

/**
 * POST /api/page-rules
 * Create a new page rule.
 *
 * Body: { widgetCode, name, urlPath, popupDelaySeconds?, welcomeMessage?, staticContext?, contextOnlyMode? }
 */
router.post('/', requireAuth, requirePermission('widgets', 'edit'), async (req, res) => {
  const { widgetCode, name, urlPath, popupDelaySeconds, welcomeMessage, staticContext, contextOnlyMode } = req.body;

  if (!widgetCode || !name || !urlPath) {
    return res.status(400).json({ error: 'widgetCode, name, and urlPath are required.' });
  }

  try {
    const rule = await createPageRule({
      widgetCode,
      name,
      urlPath,
      popupDelaySeconds: popupDelaySeconds !== undefined ? Number(popupDelaySeconds) : null,
      welcomeMessage,
      staticContext,
      contextOnlyMode,
    });
    logger.info('PageRule created', { widgetCode, urlPath, by: req.admin.username });
    return res.status(201).json({ rule });
  } catch (err) {
    // Duplicate urlPath for this widget
    if (err.code === 11000) {
      return res.status(409).json({ error: `A rule for path "${urlPath}" already exists for this widget.` });
    }
    logger.error('POST /api/page-rules error', { error: err.message });
    return res.status(500).json({ error: 'Failed to create page rule.' });
  }
});

/**
 * PUT /api/page-rules/:id
 * Update a page rule.
 *
 * Body: { name?, urlPath?, popupDelaySeconds?, welcomeMessage?, staticContext?, contextOnlyMode? }
 */
router.put('/:id', requireAuth, requirePermission('widgets', 'edit'), async (req, res) => {
  const { id } = req.params;
  const { name, urlPath, popupDelaySeconds, welcomeMessage, staticContext, contextOnlyMode } = req.body;

  try {
    const updates = { name, urlPath, welcomeMessage, staticContext, contextOnlyMode };
    // Only include popupDelaySeconds if it was explicitly passed
    if (popupDelaySeconds !== undefined) {
      updates.popupDelaySeconds = popupDelaySeconds === null ? null : Number(popupDelaySeconds);
    }

    const rule = await updatePageRule(id, updates);
    if (!rule) {
      return res.status(404).json({ error: 'Page rule not found.' });
    }
    logger.info('PageRule updated', { id, by: req.admin.username });
    return res.json({ rule });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'A rule for that path already exists for this widget.' });
    }
    logger.error('PUT /api/page-rules/:id error', { id, error: err.message });
    return res.status(500).json({ error: 'Failed to update page rule.' });
  }
});

/**
 * DELETE /api/page-rules/:id
 * Delete a page rule.
 */
router.delete('/:id', requireAuth, requirePermission('widgets', 'delete'), async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await deletePageRule(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Page rule not found.' });
    }
    logger.info('PageRule deleted', { id, by: req.admin.username });
    return res.json({ success: true, message: 'Page rule deleted.' });
  } catch (err) {
    logger.error('DELETE /api/page-rules/:id error', { id, error: err.message });
    return res.status(500).json({ error: 'Failed to delete page rule.' });
  }
});

module.exports = router;
