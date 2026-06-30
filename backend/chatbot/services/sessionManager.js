'use strict';
const config = require('../../common/config');
const logger = require('../../common/utils/logger');
const store = require('../rag/store');
const gemini = require('./gemini');

/**
 * Session Manager
 *
 * Tracks active chat sessions in memory.
 * Each session stores:
 *   - widgetCode, pageUrl, pageTitle
 *   - Current page context (raw, for fallback)
 *   - Lead data collected so far
 *   - Strategy used for current page (direct / rag / summarize)
 *   - matchedPageRule: the PageRule doc that matched the current URL (or null)
 *   - Timestamps
 *
 * Sessions auto-expire after TTL minutes of inactivity.
 */

const TTL_MS = config.sessionTtlMinutes * 60 * 1000;

/** @type {Map<string, object>} */
const activeSessions = new Map();

// Periodic cleanup of expired sessions
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  let pruned = 0;
  for (const [id, session] of activeSessions.entries()) {
    if (now > session.expiresAt) {
      _destroySession(id);
      pruned++;
    }
  }
  if (pruned > 0) logger.info(`SessionManager: pruned ${pruned} expired session(s)`);
}, 5 * 60 * 1000);

cleanupInterval.unref?.();

// ─── Internal ─────────────────────────────────────────────────────────────────

function _destroySession(sessionId) {
  store.clear(sessionId);
  gemini.clearHistory(sessionId);
  activeSessions.delete(sessionId);
  logger.debug(`Session destroyed: ${sessionId}`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create or refresh a session.
 * @param {string} sessionId
 * @param {object} params
 * @param {string} params.widgetCode
 * @param {string} [params.pageUrl]
 * @param {string} [params.pageTitle]
 * @returns {object} The session data
 */
function createOrRefreshSession(sessionId, { widgetCode, pageUrl, pageTitle } = {}) {
  const existing = activeSessions.get(sessionId);

  const session = {
    id: sessionId,
    widgetCode: widgetCode || existing?.widgetCode || 'unknown',
    pageUrl: pageUrl || existing?.pageUrl || null,
    pageTitle: pageTitle || existing?.pageTitle || null,
    pageContext: existing?.pageContext || null,
    ragStrategy: existing?.ragStrategy || null,
    matchedPageRule: existing?.matchedPageRule || null,
    leadData: existing?.leadData || {},
    leadCaptured: existing?.leadCaptured || false,
    startedAt: existing?.startedAt || Date.now(),
    lastActive: Date.now(),
    expiresAt: Date.now() + TTL_MS,
  };

  activeSessions.set(sessionId, session);
  logger.debug(`Session created/refreshed: ${sessionId}`);
  return session;
}

/**
 * Update page context for a session.
 * @param {string} sessionId
 * @param {object} pageContext
 * @param {string} [strategy]
 */
function updatePageContext(sessionId, pageContext, strategy) {
  const session = activeSessions.get(sessionId);
  if (!session) {
    logger.warn(`updatePageContext: session ${sessionId} not found`);
    return;
  }
  session.pageContext = pageContext;
  session.pageUrl = pageContext.url || session.pageUrl;
  session.pageTitle = pageContext.title || session.pageTitle;
  session.ragStrategy = strategy || session.ragStrategy;
  session.lastActive = Date.now();
  session.expiresAt = Date.now() + TTL_MS;
}

/**
 * Get the stored page context for a session.
 * @param {string} sessionId
 * @returns {object|null}
 */
function getPageContext(sessionId) {
  return activeSessions.get(sessionId)?.pageContext || null;
}

/**
 * Touch a session to reset its TTL.
 * @param {string} sessionId
 */
function touchSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.lastActive = Date.now();
    session.expiresAt = Date.now() + TTL_MS;
    store.refreshTTL(sessionId);
  }
}

/**
 * Update partial lead data on a session.
 * @param {string} sessionId
 * @param {object} leadData
 */
function updateLeadData(sessionId, leadData) {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.leadData = { ...session.leadData, ...leadData };
    session.leadCaptured = true;
  }
}

/**
 * Store the matched PageRule for the current page URL.
 * @param {string} sessionId
 * @param {object|null} pageRule
 */
function updateMatchedPageRule(sessionId, pageRule) {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.matchedPageRule = pageRule || null;
  }
}

/**
 * Retrieve session metadata.
 * @param {string} sessionId
 * @returns {object|null}
 */
function getSession(sessionId) {
  return activeSessions.get(sessionId) || null;
}

/**
 * Return count of active sessions.
 * @returns {number}
 */
function activeCount() {
  return activeSessions.size;
}

module.exports = {
  createOrRefreshSession,
  updatePageContext,
  getPageContext,
  touchSession,
  updateLeadData,
  updateMatchedPageRule,
  getSession,
  activeCount,
};
