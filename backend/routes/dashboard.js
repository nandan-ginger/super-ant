'use strict';
const express = require('express');
const router  = express.Router();
const logger  = require('../utils/logger');
const { requireAuth } = require('../middleware/adminAuth');
const Session  = require('../database/models/Session');
const Lead     = require('../database/models/Lead');
const Message  = require('../database/models/Message');
const Widget   = require('../database/models/Widget');

/**
 * GET /api/dashboard/stats
 *
 * Returns aggregated platform statistics for the admin dashboard.
 * Single call — avoids N+1 queries from the UI hitting every endpoint.
 *
 * Response:
 * {
 *   total_widgets:      number,
 *   total_sessions:     number,
 *   total_leads:        number,
 *   sessions_with_leads: number,
 *   total_messages:     number,
 *   leads_by_intent:    [{ intent, count }],
 *   leads_today:        number,
 *   sessions_today:     number,
 *   leads_last_7_days:  [{ date, count }],   // last 7 days
 *   sessions_per_widget:[{ widget_code, name, session_count }],
 * }
 */
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const now        = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [
      totalWidgets,
      totalSessions,
      totalLeads,
      totalMessages,
      leadsToday,
      sessionsToday,
      leadsByIntent,
      leadsLast7Days,
      sessionsPerWidget,
    ] = await Promise.all([
      // Simple counts
      Widget.countDocuments(),
      Session.countDocuments(),
      Lead.countDocuments(),
      Message.countDocuments(),

      // Today's counts
      Lead.countDocuments({ capturedAt: { $gte: todayStart } }),
      Session.countDocuments({ startedAt: { $gte: todayStart } }),

      // Leads grouped by intent
      Lead.aggregate([
        { $group: { _id: '$intent', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, intent: { $ifNull: ['$_id', 'Unknown'] }, count: 1 } },
      ]),

      // Leads per day for last 7 days
      Lead.aggregate([
        { $match: { capturedAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: {
              year:  { $year:  '$capturedAt' },
              month: { $month: '$capturedAt' },
              day:   { $dayOfMonth: '$capturedAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        {
          $project: {
            _id: 0,
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: {
                  $dateFromParts: {
                    year: '$_id.year', month: '$_id.month', day: '$_id.day',
                  },
                },
              },
            },
            count: 1,
          },
        },
      ]),

      // Sessions per widget (top 10)
      Session.aggregate([
        { $group: { _id: '$widgetCode', session_count: { $sum: 1 } } },
        { $sort: { session_count: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, widget_code: '$_id', session_count: 1 } },
      ]),
    ]);

    // Enrich sessions_per_widget with widget names
    const widgetCodes = sessionsPerWidget.map(s => s.widget_code);
    const widgets = await Widget.find(
      { widgetCode: { $in: widgetCodes } },
      { widgetCode: 1, name: 1 }
    ).lean();
    const widgetNameMap = {};
    for (const w of widgets) widgetNameMap[w.widgetCode] = w.name;

    const enrichedSessionsPerWidget = sessionsPerWidget.map(s => ({
      widget_code:   s.widget_code,
      name:          widgetNameMap[s.widget_code] || s.widget_code,
      session_count: s.session_count,
    }));

    // sessions_with_leads — sessions that have at least one lead
    const sessionsWithLeads = await Lead.distinct('sessionId');

    return res.json({
      total_widgets:        totalWidgets,
      total_sessions:       totalSessions,
      total_leads:          totalLeads,
      total_messages:       totalMessages,
      sessions_with_leads:  sessionsWithLeads.length,
      leads_today:          leadsToday,
      sessions_today:       sessionsToday,
      leads_by_intent:      leadsByIntent,
      leads_last_7_days:    leadsLast7Days,
      sessions_per_widget:  enrichedSessionsPerWidget,
    });
  } catch (err) {
    logger.error('GET /api/dashboard/stats error', { error: err.message });
    return res.status(500).json({ error: 'Failed to retrieve dashboard stats.' });
  }
});

module.exports = router;
