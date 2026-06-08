'use strict';
const config = require('../config');
const logger = require('../utils/logger');

/**
 * In-memory vector store with per-session isolation and TTL expiry.
 *
 * Structure:
 *   sessions: Map<sessionId, { chunks: EmbeddedChunk[], expiresAt: number }>
 *
 * Each embedded chunk:
 *   { id, text, heading, pageTitle, pageUrl, tokens, embedding: number[] }
 */

const TTL_MS = config.sessionTtlMinutes * 60 * 1000;

/** @type {Map<string, { chunks: object[], expiresAt: number }>} */
const sessions = new Map();

// Cleanup interval — prune expired sessions every 5 minutes
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  let pruned = 0;
  for (const [id, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(id);
      pruned++;
    }
  }
  if (pruned > 0) logger.debug(`RAG store: pruned ${pruned} expired session(s)`);
}, 5 * 60 * 1000);

// Prevent the interval from keeping the process alive in tests
cleanupInterval.unref?.();

// ─── Maths helpers ────────────────────────────────────────────────────────────

/**
 * Dot product of two equal-length vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/**
 * L2 (Euclidean) magnitude of a vector.
 * @param {number[]} v
 * @returns {number}
 */
function magnitude(v) {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

/**
 * Cosine similarity between two vectors. Returns a value in [-1, 1].
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function cosineSimilarity(a, b) {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dot(a, b) / (magA * magB);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Store embedded chunks for a session.
 * Replaces any existing chunks for that session (context update).
 *
 * @param {string} sessionId
 * @param {object[]} embeddedChunks  Array of chunks with `embedding` field
 */
function addChunks(sessionId, embeddedChunks) {
  sessions.set(sessionId, {
    chunks: embeddedChunks,
    expiresAt: Date.now() + TTL_MS,
  });
  logger.debug(`RAG store: stored ${embeddedChunks.length} chunks for session ${sessionId}`);
}

/**
 * Extend TTL for a session (call on each user interaction).
 * @param {string} sessionId
 */
function refreshTTL(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.expiresAt = Date.now() + TTL_MS;
  }
}

/**
 * Retrieve the top-K most semantically similar chunks for a query embedding.
 *
 * @param {string} sessionId
 * @param {number[]} queryEmbedding
 * @param {number} [topK=5]
 * @returns {object[]}  Sorted array of chunks with `score` added
 */
function search(sessionId, queryEmbedding, topK = config.rag.topK) {
  const session = sessions.get(sessionId);
  if (!session || session.chunks.length === 0) return [];

  // Refresh TTL on access
  refreshTTL(sessionId);

  const scored = session.chunks.map((chunk) => ({
    ...chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

/**
 * Check if a session has stored embeddings.
 * @param {string} sessionId
 * @returns {boolean}
 */
function hasChunks(sessionId) {
  const session = sessions.get(sessionId);
  return !!session && session.chunks.length > 0;
}

/**
 * Remove a session from the store.
 * @param {string} sessionId
 */
function clear(sessionId) {
  sessions.delete(sessionId);
  logger.debug(`RAG store: cleared session ${sessionId}`);
}

/**
 * Return the number of chunks stored for a session (for diagnostics).
 * @param {string} sessionId
 * @returns {number}
 */
function chunkCount(sessionId) {
  return sessions.get(sessionId)?.chunks.length ?? 0;
}

module.exports = { addChunks, search, hasChunks, clear, chunkCount, refreshTTL };
