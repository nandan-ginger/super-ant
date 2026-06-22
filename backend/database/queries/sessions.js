'use strict';
const Session = require('../models/Session');

/**
 * Create or update a session record.
 * Uses findOneAndUpdate with upsert to handle reconnects gracefully.
 * @param {object} params
 * @param {string} params.id
 * @param {string} params.widgetCode
 * @param {string} [params.pageUrl]
 * @param {string} [params.pageTitle]
 */
async function upsertSession({ id, widgetCode, pageUrl, pageTitle }) {
  const doc = await Session.findOneAndUpdate(
    { _id: id },
    {
      $set: {
        widgetCode,
        pageUrl:   pageUrl   || null,
        pageTitle: pageTitle || null,
        lastActive: new Date(),
      },
      $setOnInsert: {
        _id:       id,
        startedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after' }
  );
  return doc.toJSON();
}

/**
 * Touch the lastActive timestamp for a session.
 * @param {string} sessionId
 */
async function touchSession(sessionId) {
  await Session.findByIdAndUpdate(sessionId, { $set: { lastActive: new Date() } });
}

/**
 * Find a session by ID.
 * @param {string} sessionId
 */
async function getSession(sessionId) {
  const doc = await Session.findById(sessionId);
  return doc ? doc.toJSON() : null;
}

/**
 * List sessions for a widget code with pagination.
 * Includes message count and lead name if available.
 * @param {string} widgetCode
 * @param {object} [options]
 * @param {number} [options.limit=50]
 * @param {number} [options.offset=0]
 */
async function listSessionsByWidget(widgetCode, { limit = 50, offset = 0 } = {}) {
  const Message  = require('../models/Message');
  const Lead     = require('../models/Lead');

  // Get sessions page
  const sessions = await Session.find({ widgetCode })
    .sort({ startedAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  if (sessions.length === 0) return [];

  const sessionIds = sessions.map(s => s._id);

  // Count messages per session
  const messageCounts = await Message.aggregate([
    { $match: { sessionId: { $in: sessionIds } } },
    { $group: { _id: '$sessionId', count: { $sum: 1 } } },
  ]);
  const countMap = {};
  for (const m of messageCounts) countMap[m._id] = m.count;

  // Get lead info per session (take the most recent lead per session)
  const leads = await Lead.find({ sessionId: { $in: sessionIds } })
    .sort({ capturedAt: -1 })
    .lean();
  const leadMap = {};
  for (const l of leads) {
    if (!leadMap[l.sessionId]) leadMap[l.sessionId] = l; // first = most recent
  }

  // Combine into flat shape matching the old PostgreSQL rows
  return sessions.map(s => ({
    id:            s._id,
    widget_code:   s.widgetCode,
    page_url:      s.pageUrl   || null,
    page_title:    s.pageTitle || null,
    started_at:    s.startedAt,
    last_active:   s.lastActive,
    message_count: countMap[s._id] || 0,
    visitor_name:  leadMap[s._id]?.name  || null,
    visitor_email: leadMap[s._id]?.email || null,
    visitor_phone: leadMap[s._id]?.phone || null,
    lead_id:       leadMap[s._id]?._id?.toString() || null,
  }));
}

/**
 * Count total sessions for a widget.
 * @param {string} widgetCode
 */
async function countSessionsByWidget(widgetCode) {
  return Session.countDocuments({ widgetCode });
}

/**
 * Get a single session enriched with lead info (for visitor detail page).
 * @param {string} sessionId
 */
async function getSessionWithLeadInfo(sessionId) {
  const Message = require('../models/Message');
  const Lead    = require('../models/Lead');

  const session = await Session.findById(sessionId).lean();
  if (!session) return null;

  const [messageCount, lead] = await Promise.all([
    Message.countDocuments({ sessionId }),
    Lead.findOne({ sessionId }).sort({ capturedAt: -1 }).lean(),
  ]);

  return {
    id:                   session._id,
    widget_code:          session.widgetCode,
    page_url:             session.pageUrl   || null,
    page_title:           session.pageTitle || null,
    started_at:           session.startedAt,
    last_active:          session.lastActive,
    message_count:        messageCount,
    lead_id:              lead?._id?.toString()  || null,
    visitor_name:         lead?.name             || null,
    visitor_email:        lead?.email            || null,
    visitor_phone:        lead?.phone            || null,
    visitor_requirement:  lead?.requirement      || null,
    visitor_intent:       lead?.intent           || null,
    lead_captured_at:     lead?.capturedAt       || null,
  };
}

module.exports = {
  upsertSession,
  touchSession,
  getSession,
  listSessionsByWidget,
  countSessionsByWidget,
  getSessionWithLeadInfo,
};
