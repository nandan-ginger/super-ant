'use strict';
const Lead = require('../models/Lead');

/**
 * Save a new lead record to the database.
 * widgetCode is looked up from the session if not explicitly supplied.
 * @param {object} params
 * @param {string} [params.sessionId]
 * @param {string} [params.widgetCode]  Optional — auto-resolved from session when omitted
 * @param {string} [params.name]
 * @param {string} [params.email]
 * @param {string} [params.phone]
 * @param {string} [params.requirement]
 * @param {string} [params.intent]
 * @param {string} [params.pageUrl]
 * @returns {Promise<object>} The saved lead document
 */
async function saveLead({ sessionId, widgetCode, name, email, phone, requirement, intent, pageUrl }) {
  // If widgetCode is not provided, try to get it from the session
  let resolvedWidgetCode = widgetCode || null;
  if (!resolvedWidgetCode && sessionId) {
    const Session = require('../models/Session');
    const session = await Session.findById(sessionId).lean();
    resolvedWidgetCode = session?.widgetCode || null;
  }

  const lead = await Lead.create({
    sessionId:   sessionId   || null,
    widgetCode:  resolvedWidgetCode,
    name:        name        || null,
    email:       email       || null,
    phone:       phone       || null,
    requirement: requirement || null,
    intent:      intent      || null,
    pageUrl:     pageUrl     || null,
    capturedAt:  new Date(),
  });
  return lead.toJSON();
}

/**
 * Get a single lead by its ID.
 * @param {string} leadId
 * @returns {Promise<object|null>}
 */
async function getLeadById(leadId) {
  const lead = await Lead.findById(leadId).lean();
  if (!lead) return null;
  return {
    id:          lead._id.toString(),
    session_id:  lead.sessionId,
    widget_code: lead.widgetCode,
    name:        lead.name,
    email:       lead.email,
    phone:       lead.phone,
    requirement: lead.requirement,
    intent:      lead.intent,
    page_url:    lead.pageUrl,
    captured_at: lead.capturedAt,
  };
}

/**
 * Get the lead associated with a session (most recent, if any).
 * @param {string} sessionId
 * @returns {Promise<object|null>}
 */
async function getLeadBySession(sessionId) {
  const lead = await Lead.findOne({ sessionId }).sort({ capturedAt: -1 }).lean();
  if (!lead) return null;
  return {
    id:          lead._id.toString(),
    session_id:  lead.sessionId,
    widget_code: lead.widgetCode,
    name:        lead.name,
    email:       lead.email,
    phone:       lead.phone,
    requirement: lead.requirement,
    intent:      lead.intent,
    page_url:    lead.pageUrl,
    captured_at: lead.capturedAt,
  };
}

/**
 * Get a paginated list of all leads, newest first.
 * @param {object} [options]
 * @param {number} [options.limit=100]
 * @param {number} [options.offset=0]
 * @param {string} [options.intent]       Filter by intent category
 * @param {string} [options.widgetCode]   Filter by widget (denormalized on Lead)
 */
async function listLeads({ limit = 100, offset = 0, intent, widgetCode } = {}) {
  const filter = {};
  if (intent)      filter.intent      = intent;
  if (widgetCode)  filter.widgetCode  = widgetCode;

  const leads = await Lead.find(filter)
    .sort({ capturedAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  return leads.map(l => ({
    id:          l._id.toString(),
    session_id:  l.sessionId,
    widget_code: l.widgetCode,
    name:        l.name,
    email:       l.email,
    phone:       l.phone,
    requirement: l.requirement,
    intent:      l.intent,
    page_url:    l.pageUrl,
    captured_at: l.capturedAt,
  }));
}

/**
 * Count total leads (optionally filtered).
 * @param {string} [intent]
 * @param {string} [widgetCode]
 */
async function countLeads(intent, widgetCode) {
  const filter = {};
  if (intent)     filter.intent     = intent;
  if (widgetCode) filter.widgetCode = widgetCode;
  return Lead.countDocuments(filter);
}

module.exports = { saveLead, getLeadById, getLeadBySession, listLeads, countLeads };
