'use strict';
const config = require('../config');
const logger = require('../utils/logger');
const { estimateTokens } = require('../utils/tokenCounter');
const { chunkPageContext } = require('./chunker');
const { embedChunks, embedQuery } = require('./embedder');
const store = require('./store');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

/**
 * Orchestrates the full RAG flow:
 *   1. Determine routing strategy based on token count
 *   2. For chunk-and-retrieve: chunk → embed → store
 *   3. For a query: embed query → similarity search → return top chunks
 */

// ─── Strategy thresholds ──────────────────────────────────────────────────────
const DIRECT_LIMIT = config.rag.directLimit;   // < 5000 tokens → send directly
const CHUNK_LIMIT  = config.rag.chunkLimit;    // 5000–50000 → chunk & retrieve

/**
 * Determine which RAG strategy to use for the given page context.
 * @param {object} pageContext
 * @returns {'direct'|'rag'|'summarize'}
 */
function determineStrategy(pageContext) {
  const fullText = [
    pageContext.title,
    pageContext.visibleText,
    ...(pageContext.tables || []),
  ].join(' ');

  const tokens = estimateTokens(fullText);
  logger.debug(`RAG strategy: estimated ${tokens} tokens for page "${pageContext.title}"`);

  if (tokens < DIRECT_LIMIT)  return 'direct';
  if (tokens <= CHUNK_LIMIT)  return 'rag';
  return 'summarize';
}

/**
 * Index a page context into the vector store for a session.
 * Called when the widget sends a `context_update` event.
 *
 * @param {string} sessionId
 * @param {object} pageContext
 * @returns {Promise<{ strategy: string, chunkCount: number }>}
 */
async function indexPageContext(sessionId, pageContext) {
  const strategy = determineStrategy(pageContext);
  logger.info(`Indexing page for session ${sessionId} using strategy: ${strategy}`);

  if (strategy === 'direct') {
    // No chunking needed — store a single "chunk" representing the full text
    const fullText = [
      `Page: ${pageContext.title}`,
      `URL: ${pageContext.url}`,
      pageContext.visibleText,
    ].join('\n\n');

    const chunks = [{ id: 0, text: fullText, heading: pageContext.title, tokens: estimateTokens(fullText) }];
    const embedded = await embedChunks(chunks);
    store.addChunks(sessionId, embedded);
    return { strategy, chunkCount: 1 };
  }

  if (strategy === 'summarize') {
    // Summarize the page first, then chunk the summary
    logger.info(`Page too large — summarizing before indexing (session ${sessionId})`);
    const summarized = await summarizePage(pageContext);
    const summaryContext = { ...pageContext, visibleText: summarized };
    const chunks = chunkPageContext(summaryContext);
    const embedded = await embedChunks(chunks);
    store.addChunks(sessionId, embedded);
    return { strategy, chunkCount: chunks.length };
  }

  // strategy === 'rag'
  const chunks = chunkPageContext(pageContext);
  const embedded = await embedChunks(chunks);
  store.addChunks(sessionId, embedded);
  return { strategy, chunkCount: chunks.length };
}

/**
 * Retrieve the most relevant text context for a user question.
 * Returns a formatted string ready to inject into the Gemini prompt.
 *
 * @param {string} sessionId
 * @param {string} question
 * @param {object} [pageContext]  Full context (used as fallback if no embeddings)
 * @returns {Promise<{ context: string, strategy: string, chunks: object[] }>}
 */
async function retrieveContext(sessionId, question, pageContext) {
  // If no embeddings stored yet, fall back to direct text
  if (!store.hasChunks(sessionId)) {
    logger.warn(`No embeddings for session ${sessionId} — using direct page text fallback`);
    const fallback = pageContext
      ? [pageContext.title, pageContext.visibleText].filter(Boolean).join('\n\n')
      : '';
    return { context: fallback, strategy: 'fallback', chunks: [] };
  }

  const queryEmbedding = await embedQuery(question);
  const topChunks = store.search(sessionId, queryEmbedding, config.rag.topK);

  if (topChunks.length === 0) {
    return { context: '', strategy: 'rag', chunks: [] };
  }

  // Format chunks into readable context block
  const contextLines = topChunks.map((c, i) => {
    return `[Excerpt ${i + 1} — ${c.heading || 'General'}]\n${c.text}`;
  });

  const context = contextLines.join('\n\n---\n\n');

  logger.debug(`Retrieved ${topChunks.length} chunks for question`, {
    sessionId,
    scores: topChunks.map((c) => c.score.toFixed(3)),
  });

  return { context, strategy: 'rag', chunks: topChunks };
}

/**
 * Summarize a large page using Gemini to reduce token count.
 * @param {object} pageContext
 * @returns {Promise<string>}
 */
async function summarizePage(pageContext) {
  const model = genAI.getGenerativeModel({ model: config.geminiChatModel });
  const textToSummarize = [
    `Page Title: ${pageContext.title}`,
    `URL: ${pageContext.url}`,
    pageContext.visibleText,
  ].join('\n\n');

  // Truncate to ~30k tokens worth of words for the summarization call
  const words = textToSummarize.split(/\s+/).slice(0, 23000);
  const truncated = words.join(' ');

  const prompt = `You are a content analyst. Summarize the following web page content comprehensively, 
preserving all product details, pricing, features, contact information, and business-critical data.
Output a structured summary in plain text, approximately 1500 words.

Page Content:
${truncated}`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

module.exports = { indexPageContext, retrieveContext, determineStrategy };
