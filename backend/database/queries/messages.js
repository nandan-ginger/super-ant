'use strict';
const { query } = require('../connection');

/**
 * Persist a single chat message.
 * @param {object} params
 * @param {string} params.sessionId
 * @param {'user'|'assistant'|'system'} params.role
 * @param {string} params.content
 */
async function saveMessage({ sessionId, role, content }) {
  const sql = `
    INSERT INTO messages (session_id, role, content)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const { rows } = await query(sql, [sessionId, role, content]);
  return rows[0];
}

/**
 * Retrieve the last N messages for a session, ordered oldest-first.
 * @param {string} sessionId
 * @param {number} [limit=50]
 */
async function getMessages(sessionId, limit = 50) {
  const sql = `
    SELECT * FROM (
      SELECT * FROM messages
      WHERE session_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    ) sub
    ORDER BY created_at ASC
  `;
  const { rows } = await query(sql, [sessionId, limit]);
  return rows;
}

/**
 * Delete all messages for a session (e.g., on reset).
 * @param {string} sessionId
 */
async function clearMessages(sessionId) {
  await query(`DELETE FROM messages WHERE session_id = $1`, [sessionId]);
}

module.exports = { saveMessage, getMessages, clearMessages };
