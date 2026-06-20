'use strict';
const { query } = require('../connection');
const crypto = require('crypto');

/**
 * Generate a unique short widget code: wgt_ + 8 random alphanumeric chars
 */
function generateWidgetCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = 'wgt_';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Create a new widget. Generates a unique widget_code automatically.
 * @param {object} params
 * @param {string} params.name
 * @param {string} params.url
 * @param {string} [params.description]
 * @returns {Promise<object>} The created widget row
 */
async function createWidget({ name, url, description }) {
  // Try up to 5 times in case of a (very unlikely) collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const widget_code = generateWidgetCode();
    try {
      const sql = `
        INSERT INTO widgets (widget_code, name, url, description)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const { rows } = await query(sql, [widget_code, name, url, description || null]);
      return rows[0];
    } catch (err) {
      if (err.message.includes('unique') || err.message.includes('duplicate')) {
        continue; // retry with a new code
      }
      throw err;
    }
  }
  throw new Error('Failed to generate unique widget code after 5 attempts.');
}

/**
 * Get a single widget by its widget_code.
 * @param {string} widgetCode
 * @returns {Promise<object|null>}
 */
async function getWidgetByCode(widgetCode) {
  const { rows } = await query(
    `SELECT * FROM widgets WHERE widget_code = $1`,
    [widgetCode]
  );
  return rows[0] || null;
}

/**
 * Get all widgets, newest first.
 * @param {object} [options]
 * @param {number} [options.limit=100]
 * @param {number} [options.offset=0]
 * @returns {Promise<object[]>}
 */
async function getAllWidgets({ limit = 100, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT * FROM widgets ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

/**
 * Count total widgets.
 */
async function countWidgets() {
  const { rows } = await query(`SELECT COUNT(*) AS total FROM widgets`);
  return parseInt(rows[0].total, 10);
}

/**
 * Update a widget's name, url, and/or description.
 * @param {string} widgetCode
 * @param {object} updates
 * @param {string} [updates.name]
 * @param {string} [updates.url]
 * @param {string} [updates.description]
 * @returns {Promise<object|null>} Updated widget or null if not found
 */
async function updateWidget(widgetCode, { name, url, description }) {
  const { rows } = await query(
    `UPDATE widgets
     SET name        = COALESCE($2, name),
         url         = COALESCE($3, url),
         description = COALESCE($4, description),
         updated_at  = NOW()
     WHERE widget_code = $1
     RETURNING *`,
    [widgetCode, name || null, url || null, description !== undefined ? description : null]
  );
  return rows[0] || null;
}

/**
 * Delete a widget by widget_code.
 * @param {string} widgetCode
 * @returns {Promise<boolean>} true if deleted, false if not found
 */
async function deleteWidget(widgetCode) {
  const { rowCount } = await query(
    `DELETE FROM widgets WHERE widget_code = $1`,
    [widgetCode]
  );
  return rowCount > 0;
}

/**
 * Check if a widget_code exists (used for socket validation).
 * @param {string} widgetCode
 * @returns {Promise<boolean>}
 */
async function widgetExists(widgetCode) {
  const { rows } = await query(
    `SELECT 1 FROM widgets WHERE widget_code = $1`,
    [widgetCode]
  );
  return rows.length > 0;
}

module.exports = {
  createWidget,
  getWidgetByCode,
  getAllWidgets,
  countWidgets,
  updateWidget,
  deleteWidget,
  widgetExists,
};
