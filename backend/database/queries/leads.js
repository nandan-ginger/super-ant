'use strict';
const { query } = require('../connection');

/**
 * Save a new lead record to the database.
 * @param {object} params
 * @param {string} [params.sessionId]
 * @param {string} [params.name]
 * @param {string} [params.email]
 * @param {string} [params.phone]
 * @param {string} [params.requirement]
 * @param {string} [params.intent]
 * @param {string} [params.pageUrl]
 * @returns {Promise<object>} The saved lead row
 */
async function saveLead({ sessionId, name, email, phone, requirement, intent, pageUrl }) {
  const sql = `
    INSERT INTO leads (session_id, name, email, phone, requirement, intent, page_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const { rows } = await query(sql, [
    sessionId || null,
    name || null,
    email || null,
    phone || null,
    requirement || null,
    intent || null,
    pageUrl || null,
  ]);
  return rows[0];
}

/**
 * Get a single lead by its UUID.
 * @param {string} leadId
 * @returns {Promise<object|null>}
 */
async function getLeadById(leadId) {
  const { rows } = await query(
    `SELECT l.*, s.widget_code FROM leads l
     LEFT JOIN sessions s ON s.id = l.session_id
     WHERE l.id = $1`,
    [leadId]
  );
  return rows[0] || null;
}

/**
 * Get the lead associated with a session (if any).
 * @param {string} sessionId
 * @returns {Promise<object|null>}
 */
async function getLeadBySession(sessionId) {
  const { rows } = await query(
    `SELECT * FROM leads WHERE session_id = $1 ORDER BY captured_at DESC LIMIT 1`,
    [sessionId]
  );
  return rows[0] || null;
}

/**
 * Get a paginated list of all leads, newest first.
 * @param {object} [options]
 * @param {number} [options.limit=100]
 * @param {number} [options.offset=0]
 * @param {string} [options.intent]       Filter by intent category
 * @param {string} [options.widgetCode]   Filter by widget (joins sessions)
 */
async function listLeads({ limit = 100, offset = 0, intent, widgetCode } = {}) {
  const params = [];
  let conditions = [];

  let sql = `
    SELECT l.*, s.widget_code
    FROM leads l
    LEFT JOIN sessions s ON s.id = l.session_id
  `;

  if (intent) {
    params.push(intent);
    conditions.push(`l.intent = $${params.length}`);
  }
  if (widgetCode) {
    params.push(widgetCode);
    conditions.push(`s.widget_code = $${params.length}`);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ` + conditions.join(' AND ');
  }

  params.push(limit, offset);
  sql += ` ORDER BY l.captured_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await query(sql, params);
  return rows;
}

/**
 * Count total leads (optionally filtered by intent and/or widgetCode).
 * @param {string} [intent]
 * @param {string} [widgetCode]
 */
async function countLeads(intent, widgetCode) {
  const params = [];
  let conditions = [];

  let sql = `
    SELECT COUNT(*) AS total
    FROM leads l
    LEFT JOIN sessions s ON s.id = l.session_id
  `;

  if (intent) {
    params.push(intent);
    conditions.push(`l.intent = $${params.length}`);
  }
  if (widgetCode) {
    params.push(widgetCode);
    conditions.push(`s.widget_code = $${params.length}`);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ` + conditions.join(' AND ');
  }

  const { rows } = await query(sql, params);
  return parseInt(rows[0].total, 10);
}

module.exports = { saveLead, getLeadById, getLeadBySession, listLeads, countLeads };
