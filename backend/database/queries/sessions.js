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
 * List sessions for a widget code, newest first.
 * @param {string} widgetCode
 * @param {number} [limit=50]
 */
async function listSessionsByWidget(widgetCode, limit = 50) {
  const { rows } = await query(
    `SELECT * FROM sessions WHERE widget_code = $1 ORDER BY started_at DESC LIMIT $2`,
    [widgetCode, limit]
  );
  return rows;
}

module.exports = { upsertSession, touchSession, getSession, listSessionsByWidget };
