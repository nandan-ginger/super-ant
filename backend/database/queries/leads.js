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
 * Get a paginated list of all leads, newest first.
 * @param {object} [options]
 * @param {number} [options.limit=100]
 * @param {number} [options.offset=0]
 * @param {string} [options.intent]  Filter by intent
 */
async function listLeads({ limit = 100, offset = 0, intent } = {}) {
  let sql = `SELECT * FROM leads`;
  const params = [];

  if (intent) {
    params.push(intent);
    sql += ` WHERE intent = $${params.length}`;
  }

  params.push(limit, offset);
  sql += ` ORDER BY captured_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await query(sql, params);
  return rows;
}

/**
 * Count total leads (optionally filtered by intent).
 * @param {string} [intent]
 */
async function countLeads(intent) {
  let sql = `SELECT COUNT(*) AS total FROM leads`;
  const params = [];
  if (intent) {
    params.push(intent);
    sql += ` WHERE intent = $1`;
  }
  const { rows } = await query(sql, params);
  return parseInt(rows[0].total, 10);
}

module.exports = { saveLead, listLeads, countLeads };
