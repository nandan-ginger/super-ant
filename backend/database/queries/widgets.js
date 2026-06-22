'use strict';
const crypto = require('crypto');
const Widget = require('../models/Widget');

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
 * @returns {Promise<object>} The created widget
 */
async function createWidget({ name, url, description }) {
  // Try up to 5 times in case of a (very unlikely) collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const widgetCode = generateWidgetCode();
    try {
      const widget = await Widget.create({
        widgetCode,
        name,
        url,
        description: description || null,
        createdAt:   new Date(),
        updatedAt:   new Date(),
      });
      return widget.toJSON();
    } catch (err) {
      if (err.code === 11000) {
        continue; // duplicate key — retry with new code
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
  const widget = await Widget.findOne({ widgetCode }).lean();
  if (!widget) return null;
  return _toRow(widget);
}

/**
 * Get all widgets, newest first.
 * @param {object} [options]
 * @param {number} [options.limit=100]
 * @param {number} [options.offset=0]
 * @returns {Promise<object[]>}
 */
async function getAllWidgets({ limit = 100, offset = 0 } = {}) {
  const widgets = await Widget.find()
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();
  return widgets.map(_toRow);
}

/**
 * Count total widgets.
 */
async function countWidgets() {
  return Widget.countDocuments();
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
  const $set = { updatedAt: new Date() };
  if (name        !== undefined && name        !== null) $set.name        = name;
  if (url         !== undefined && url         !== null) $set.url         = url;
  if (description !== undefined)                         $set.description = description || null;

  const widget = await Widget.findOneAndUpdate(
    { widgetCode },
    { $set },
    { returnDocument: 'after' }
  ).lean();
  return widget ? _toRow(widget) : null;
}

/**
 * Delete a widget by widget_code.
 * @param {string} widgetCode
 * @returns {Promise<boolean>} true if deleted, false if not found
 */
async function deleteWidget(widgetCode) {
  const result = await Widget.findOneAndDelete({ widgetCode });
  return !!result;
}

/**
 * Check if a widget_code exists (used for socket validation).
 * @param {string} widgetCode
 * @returns {Promise<boolean>}
 */
async function widgetExists(widgetCode) {
  const exists = await Widget.exists({ widgetCode });
  return !!exists;
}

/** Map a lean Mongoose doc to the snake_case shape the routes expect. */
function _toRow(w) {
  return {
    id:          w._id.toString(),
    widget_code: w.widgetCode,
    name:        w.name,
    url:         w.url,
    description: w.description,
    created_at:  w.createdAt,
    updated_at:  w.updatedAt,
  };
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
