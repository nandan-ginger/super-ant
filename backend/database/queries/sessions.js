'use strict';
const { query } = require('../connection');

/**
 * Create or update a session record.
 * Uses INSERT … ON CONFLICT to handle reconnects gracefully.
 * @param {object} params
 * @param {string} params.id
 * @param {string} params.widgetCode
 * @param {string} [params.pageUrl]
 * @param {string} [params.pageTitle]
 */
async function upsertSession({ id, widgetCode, pageUrl, pageTitle }) {
  const sql = `
    INSERT INTO sessions (id, widget_code, page_url, page_title)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (id) DO UPDATE
      SET last_active = NOW(),
          page_url    = EXCLUDED.page_url,
          page_title  = EXCLUDED.page_title
    RETURNING *
  `;
  const { rows } = await query(sql, [id, widgetCode, pageUrl || null, pageTitle || null]);
  return rows[0];
}

/**
 * Touch the last_active timestamp for a session.
 * @param {string} sessionId
 */
async function touchSession(sessionId) {
  await query(`UPDATE sessions SET last_active = NOW() WHERE id = $1`, [sessionId]);
}

/**
 * Find a session by ID.
 * @param {string} sessionId
 */
async function getSession(sessionId) {
  const { rows } = await query(`SELECT * FROM sessions WHERE id = $1`, [sessionId]);
  return rows[0] || null;
}

/**
 * List sessions for a widget code with pagination, message count, and lead name if available.
 * Used for both live chats and visitors views.
 * @param {string} widgetCode
 * @param {object} [options]
 * @param {number} [options.limit=50]
 * @param {number} [options.offset=0]
 */
async function listSessionsByWidget(widgetCode, { limit = 50, offset = 0 } = {}) {
  const sql = `
    SELECT
      s.id,
      s.widget_code,
      s.page_url,
      s.page_title,
      s.started_at,
      s.last_active,
      COUNT(DISTINCT m.id)::int        AS message_count,
      l.name                           AS visitor_name,
      l.email                          AS visitor_email,
      l.phone                          AS visitor_phone,
      l.id                             AS lead_id
    FROM sessions s
    LEFT JOIN messages m ON m.session_id = s.id
    LEFT JOIN leads l    ON l.session_id = s.id
    WHERE s.widget_code = $1
    GROUP BY s.id, l.name, l.email, l.phone, l.id
    ORDER BY s.started_at DESC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await query(sql, [widgetCode, limit, offset]);
  return rows;
}

/**
 * Count total sessions for a widget.
 * @param {string} widgetCode
 */
async function countSessionsByWidget(widgetCode) {
  const { rows } = await query(
    `SELECT COUNT(*) AS total FROM sessions WHERE widget_code = $1`,
    [widgetCode]
  );
  return parseInt(rows[0].total, 10);
}

/**
 * Get a single session enriched with lead info (for visitor detail page).
 * @param {string} sessionId
 */
async function getSessionWithLeadInfo(sessionId) {
  const sql = `
    SELECT
      s.id,
      s.widget_code,
      s.page_url,
      s.page_title,
      s.started_at,
      s.last_active,
      COUNT(DISTINCT m.id)::int  AS message_count,
      l.id                       AS lead_id,
      l.name                     AS visitor_name,
      l.email                    AS visitor_email,
      l.phone                    AS visitor_phone,
      l.requirement              AS visitor_requirement,
      l.intent                   AS visitor_intent,
      l.captured_at              AS lead_captured_at
    FROM sessions s
    LEFT JOIN messages m ON m.session_id = s.id
    LEFT JOIN leads l    ON l.session_id = s.id
    WHERE s.id = $1
    GROUP BY s.id, l.id, l.name, l.email, l.phone, l.requirement, l.intent, l.captured_at
  `;
  const { rows } = await query(sql, [sessionId]);
  return rows[0] || null;
}

module.exports = {
  upsertSession,
  touchSession,
  getSession,
  listSessionsByWidget,
  countSessionsByWidget,
  getSessionWithLeadInfo,
};

