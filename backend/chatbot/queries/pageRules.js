'use strict';
const PageRule = require('../models/PageRule');

/**
 * CRUD helpers for PageRule documents.
 *
 * urlPath is stored and matched as an exact pathname string (e.g. "/about").
 * The compound index (widgetCode + urlPath) enforces uniqueness per widget.
 */

/**
 * Create a new page rule.
 * @param {object} params
 * @param {string} params.widgetCode
 * @param {string} params.name
 * @param {string} params.urlPath          - exact pathname, e.g. "/about"
 * @param {number|null} [params.popupDelaySeconds]
 * @param {string} [params.welcomeMessage]
 * @param {string} [params.staticContext]
 * @param {boolean} [params.contextOnlyMode]
 * @returns {Promise<object>}
 */
async function createPageRule({ widgetCode, name, urlPath, popupDelaySeconds, welcomeMessage, staticContext, contextOnlyMode }) {
  const rule = await PageRule.create({
    widgetCode,
    name,
    urlPath: normalizePath(urlPath),
    popupDelaySeconds: popupDelaySeconds ?? null,
    welcomeMessage: welcomeMessage || '',
    staticContext:  staticContext  || '',
    contextOnlyMode: !!contextOnlyMode,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return rule.toJSON();
}

/**
 * Get all page rules for a widget, sorted by urlPath.
 * @param {string} widgetCode
 * @returns {Promise<object[]>}
 */
async function getPageRulesByWidget(widgetCode) {
  const rules = await PageRule.find({ widgetCode }).sort({ urlPath: 1 }).lean();
  return rules.map(_toRow);
}

/**
 * Exact path lookup — used by the socket handler on every page load.
 * @param {string} widgetCode
 * @param {string} urlPath  - exact pathname from pageContext.url
 * @returns {Promise<object|null>}
 */
async function getPageRuleByPath(widgetCode, urlPath) {
  const rule = await PageRule.findOne({
    widgetCode,
    urlPath: normalizePath(urlPath),
  }).lean();
  return rule ? _toRow(rule) : null;
}

/**
 * Update a page rule by its MongoDB _id string.
 * @param {string} id
 * @param {object} updates
 * @returns {Promise<object|null>}
 */
async function updatePageRule(id, updates) {
  const $set = { updatedAt: new Date() };
  if (updates.name              !== undefined) $set.name              = updates.name;
  if (updates.urlPath           !== undefined) $set.urlPath           = normalizePath(updates.urlPath);
  if (updates.popupDelaySeconds !== undefined) $set.popupDelaySeconds = updates.popupDelaySeconds ?? null;
  if (updates.welcomeMessage    !== undefined) $set.welcomeMessage    = updates.welcomeMessage || '';
  if (updates.staticContext     !== undefined) $set.staticContext     = updates.staticContext  || '';
  if (updates.contextOnlyMode   !== undefined) $set.contextOnlyMode   = !!updates.contextOnlyMode;

  const rule = await PageRule.findByIdAndUpdate(id, { $set }, { returnDocument: 'after' }).lean();
  return rule ? _toRow(rule) : null;
}

/**
 * Delete a page rule by its MongoDB _id string.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function deletePageRule(id) {
  const result = await PageRule.findByIdAndDelete(id);
  return !!result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalise a URL path: ensure it starts with "/" and strip trailing slashes.
 * "/about/" → "/about"   "about" → "/about"
 */
function normalizePath(path) {
  if (!path) return '/';
  let p = path.trim();
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p;
}

function _toRow(r) {
  return {
    id:                r._id.toString(),
    widgetCode:        r.widgetCode,
    name:              r.name,
    urlPath:           r.urlPath,
    popupDelaySeconds: r.popupDelaySeconds,
    welcomeMessage:    r.welcomeMessage,
    staticContext:     r.staticContext,
    contextOnlyMode:   r.contextOnlyMode,
    created_at:        r.createdAt,
    updated_at:        r.updatedAt,
  };
}

module.exports = {
  createPageRule,
  getPageRulesByWidget,
  getPageRuleByPath,
  updatePageRule,
  deletePageRule,
  normalizePath,
};
