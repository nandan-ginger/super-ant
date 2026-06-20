'use strict';
const express = require('express');
const router = express.Router();
const config = require('../config');
const logger = require('../utils/logger');
const { requireAuth, requirePermission } = require('../middleware/adminAuth');
const {
  createWidget,
  getWidgetByCode,
  getAllWidgets,
  countWidgets,
  updateWidget,
  deleteWidget,
} = require('../database/queries/widgets');

/**
 * Build the embed script snippet for a widget.
 * @param {string} widgetCode
 * @returns {string}
 */
function buildScriptCode(widgetCode) {
  const baseUrl = config.serverBaseUrl;
  return `<script type="text/javascript" id="gingerlivechat">
  var ginger_chat = ginger_chat || {};
  var currentURL = window.location.href;
  var domain = window.location.protocol + "//" + window.location.hostname + (window.location.port ? ":" + window.location.port : "");
  ginger_chat.salesiq = ginger_chat.salesiq || {
    widgetcode: "${widgetCode}",
    pageURL: currentURL,
    domain: domain,
    livechatURL: "${baseUrl}",
    values: {},
    ready: function () { console.log('[Ginger] Widget ready'); },
  };
  var d = document;
  var s = d.createElement("script");
  s.type = "text/javascript";
  s.id = "gingerlivechatscript";
  s.defer = true;
  s.src = "${baseUrl}/livechat/index.js";
  var t = d.getElementsByTagName("script")[0];
  t.parentNode.insertBefore(s, t);
</script>`;
}

/**
 * POST /api/widgets
 * Create a new widget.
 *
 * Body: { name, url, description? }
 * Returns: widget + script_code
 */
router.post('/', requireAuth, requirePermission('widgets', 'edit'), async (req, res) => {
  const { name, url, description } = req.body;

  if (!name || !url) {
    return res.status(400).json({ error: 'name and url are required.' });
  }

  try {
    const widget = await createWidget({ name, url, description });
    logger.info('Widget created', { widgetCode: widget.widget_code, by: req.admin.username });

    return res.status(201).json({
      widget: {
        ...widget,
        script_code: buildScriptCode(widget.widget_code),
      },
    });
  } catch (err) {
    logger.error('POST /api/widgets error', { error: err.message });
    return res.status(500).json({ error: 'Failed to create widget.' });
  }
});

/**
 * GET /api/widgets
 * List all widgets with pagination.
 *
 * Query: limit, offset
 */
router.get('/', requireAuth, requirePermission('widgets', 'view'), async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit,  10) || 100, 500);
    const offset = parseInt(req.query.offset, 10) || 0;

    const [widgets, total] = await Promise.all([
      getAllWidgets({ limit, offset }),
      countWidgets(),
    ]);

    return res.json({
      total,
      limit,
      offset,
      widgets: widgets.map(w => ({
        ...w,
        script_code: buildScriptCode(w.widget_code),
      })),
    });
  } catch (err) {
    logger.error('GET /api/widgets error', { error: err.message });
    return res.status(500).json({ error: 'Failed to retrieve widgets.' });
  }
});

/**
 * GET /api/widgets/:widgetCode
 * Get a single widget by its code.
 */
router.get('/:widgetCode', requireAuth, requirePermission('widgets', 'view'), async (req, res) => {
  try {
    const widget = await getWidgetByCode(req.params.widgetCode);
    if (!widget) {
      return res.status(404).json({ error: 'Widget not found.' });
    }
    return res.json({
      widget: {
        ...widget,
        script_code: buildScriptCode(widget.widget_code),
      },
    });
  } catch (err) {
    logger.error('GET /api/widgets/:widgetCode error', { error: err.message });
    return res.status(500).json({ error: 'Failed to retrieve widget.' });
  }
});

/**
 * PUT /api/widgets/:widgetCode
 * Update widget name, url, or description.
 *
 * Body: { name?, url?, description? }
 */
router.put('/:widgetCode', requireAuth, requirePermission('widgets', 'edit'), async (req, res) => {
  const { name, url, description } = req.body;

  if (!name && !url && description === undefined) {
    return res.status(400).json({ error: 'At least one of name, url, or description is required.' });
  }

  try {
    const widget = await updateWidget(req.params.widgetCode, { name, url, description });
    if (!widget) {
      return res.status(404).json({ error: 'Widget not found.' });
    }
    logger.info('Widget updated', { widgetCode: req.params.widgetCode, by: req.admin.username });
    return res.json({
      widget: {
        ...widget,
        script_code: buildScriptCode(widget.widget_code),
      },
    });
  } catch (err) {
    logger.error('PUT /api/widgets/:widgetCode error', { error: err.message });
    return res.status(500).json({ error: 'Failed to update widget.' });
  }
});

/**
 * DELETE /api/widgets/:widgetCode
 * Delete a widget.
 */
router.delete('/:widgetCode', requireAuth, requirePermission('widgets', 'delete'), async (req, res) => {
  try {
    const deleted = await deleteWidget(req.params.widgetCode);
    if (!deleted) {
      return res.status(404).json({ error: 'Widget not found.' });
    }
    logger.info('Widget deleted', { widgetCode: req.params.widgetCode, by: req.admin.username });
    return res.json({ success: true, message: 'Widget deleted successfully.' });
  } catch (err) {
    logger.error('DELETE /api/widgets/:widgetCode error', { error: err.message });
    return res.status(500).json({ error: 'Failed to delete widget.' });
  }
});

module.exports = router;
