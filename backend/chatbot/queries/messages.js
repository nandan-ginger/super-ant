'use strict';
const Message = require('../models/Message');

/**
 * Persist a single chat message.
 * @param {object} params
 * @param {string} params.sessionId
 * @param {'user'|'assistant'|'system'} params.role
 * @param {string} params.content
 */
async function saveMessage({ sessionId, role, content }) {
  const msg = await Message.create({ sessionId, role, content });
  return msg.toJSON();
}

/**
 * Retrieve the last N messages for a session, ordered oldest-first.
 * @param {string} sessionId
 * @param {number} [limit=50]
 */
async function getMessages(sessionId, limit = 50) {
  // Fetch newest N, then reverse so they are oldest-first (matches PG behaviour)
  const docs = await Message.find({ sessionId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return docs.reverse().map(d => ({
    id:         d._id.toString(),
    session_id: d.sessionId,
    role:       d.role,
    content:    d.content,
    created_at: d.createdAt,
  }));
}

/**
 * Delete all messages for a session (e.g., on reset).
 * @param {string} sessionId
 */
async function clearMessages(sessionId) {
  await Message.deleteMany({ sessionId });
}

module.exports = { saveMessage, getMessages, clearMessages };
