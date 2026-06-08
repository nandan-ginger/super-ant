'use strict';
const logger = require('../utils/logger');
const sessionManager = require('../services/sessionManager');
const geminiService = require('../services/gemini');
const leadDetector = require('../services/leadDetector');
const retriever = require('../rag/retriever');
const { upsertSession, touchSession: dbTouchSession } = require('../database/queries/sessions');
const { saveMessage } = require('../database/queries/messages');
const { saveLead } = require('../database/queries/leads');

/**
 * Attach all Socket.IO chat event handlers to a connected socket.
 *
 * Events received:
 *   context_update   → page context from the widget on load
 *   chat_message     → user sends a message
 *   lead_form_submit → user submits lead capture form
 *
 * Events emitted:
 *   chat_response        → streamed text chunk
 *   chat_response_end    → signals stream is complete
 *   lead_detected        → intent detected, widget should show lead form
 *   context_indexed      → confirmation that page was indexed
 *   error                → error details
 *
 * @param {import('socket.io').Socket} socket
 */
function attachChatHandlers(socket) {
  const sessionId = socket.handshake.query.sessionId || socket.id;
  const widgetCode = socket.handshake.query.widgetCode || 'unknown';

  logger.info(`Socket connected: ${socket.id}`, { sessionId, widgetCode });

  // Create an in-memory session immediately
  sessionManager.createOrRefreshSession(sessionId, { widgetCode });

  // ─── context_update ─────────────────────────────────────────────────────────
  socket.on('context_update', async (data) => {
    try {
      logger.info(`context_update received for session ${sessionId}`, {
        title: data?.pageContext?.title,
        url: data?.pageContext?.url,
      });

      const { pageContext } = data || {};
      if (!pageContext) {
        socket.emit('error', { message: 'context_update: pageContext is required' });
        return;
      }

      // Upsert session in PostgreSQL
      await upsertSession({
        id: sessionId,
        widgetCode,
        pageUrl: pageContext.url,
        pageTitle: pageContext.title,
      });

      // Store context and index into RAG
      const { strategy, chunkCount } = await retriever.indexPageContext(sessionId, pageContext);
      sessionManager.updatePageContext(sessionId, pageContext, strategy);

      logger.info(`Page indexed for session ${sessionId}`, { strategy, chunkCount });

      socket.emit('context_indexed', {
        strategy,
        chunkCount,
        message: `Page indexed successfully using "${strategy}" strategy.`,
      });
    } catch (err) {
      logger.error('context_update handler error', { sessionId, error: err.message });
      socket.emit('error', { message: 'Failed to process page context. Please try again.' });
    }
  });

  // ─── chat_message ────────────────────────────────────────────────────────────
  socket.on('chat_message', async (data) => {
    try {
      const { message } = data || {};
      if (!message || typeof message !== 'string' || !message.trim()) {
        socket.emit('error', { message: 'chat_message: message field is required' });
        return;
      }

      const userMessage = message.trim();

      // ── [DEBUG] API call tracker ─────────────────────────────────────────────
      let apiCallCount = 0;
      const apiCalls = [];
      const trackApiCall = (name, details = {}) => {
        apiCallCount++;
        const entry = { callIndex: apiCallCount, name, timestamp: new Date().toISOString(), ...details };
        apiCalls.push(entry);
        logger.debug(`[API-CALL #${apiCallCount}] ${name}`, { sessionId, ...details });
      };
      logger.info(`[MSG-START] chat_message received`, {
        sessionId,
        message: userMessage.slice(0, 120),
        messageLength: userMessage.length,
      });
      // ─────────────────────────────────────────────────────────────────────────

      logger.info(`chat_message from session ${sessionId}`, { message: userMessage.slice(0, 80) });

      // Touch session TTL
      sessionManager.touchSession(sessionId);
      await dbTouchSession(sessionId).catch(() => {}); // non-blocking

      // Persist user message
      await saveMessage({ sessionId, role: 'user', content: userMessage }).catch((err) => {
        logger.warn('Failed to save user message to DB', { error: err.message });
      });

      // ── Lead detection ───────────────────────────────────────────────────────
      const { leadDetected, intent } = leadDetector.detectLeadIntent(userMessage);
      if (leadDetected) {
        const session = sessionManager.getSession(sessionId);
        // Only emit lead_detected once per session (avoid repeated popups)
        if (!session?.leadCaptured) {
          logger.info(`Lead detected for session ${sessionId}`, { intent });
          socket.emit('lead_detected', {
            leadDetected: true,
            intent,
            message: 'It looks like you might be interested in our services. Would you like us to get in touch?',
          });
        }
      }

      // ── Context retrieval ────────────────────────────────────────────────────
      const pageContext = sessionManager.getPageContext(sessionId);
      const hasChunks = require('../rag/store').hasChunks(sessionId);
      logger.debug(`[DEBUG] retriever.retrieveContext called`, {
        sessionId,
        hasEmbeddings: hasChunks,
        willEmbedQuery: hasChunks, // embedQuery only called if chunks exist
      });
      if (hasChunks) trackApiCall('embedQuery (Gemini Embedding API)', { model: 'text-embedding-004', reason: 'similarity search for RAG' });

      const { context: retrievedContext, strategy } = await retriever.retrieveContext(
        sessionId,
        userMessage,
        pageContext
      );
      logger.debug(`[DEBUG] retrieveContext returned`, { sessionId, strategy, contextLength: retrievedContext?.length || 0 });

      // ── Gemini streaming response ────────────────────────────────────────────
      trackApiCall('streamResponse (Gemini Chat API)', { model: 'gemini-2.0-flash', reason: 'generate assistant reply' });
      let fullResponse = '';

      await geminiService.streamResponse(
        sessionId,
        retrievedContext,
        userMessage,
        (chunk) => {
          fullResponse += chunk;
          socket.emit('chat_response', { chunk, done: false });
        }
      );

      // Signal end of stream
      socket.emit('chat_response', { chunk: '', done: true });

      // ── [DEBUG] Summary of all API calls made for this message ───────────────
      logger.info(`[MSG-END] API calls made for this message: ${apiCallCount}`, {
        sessionId,
        totalApiCalls: apiCallCount,
        calls: apiCalls,
        responseLength: fullResponse.length,
      });
      // ─────────────────────────────────────────────────────────────────────────

      // Persist assistant response
      await saveMessage({ sessionId, role: 'assistant', content: fullResponse }).catch((err) => {
        logger.warn('Failed to save assistant message to DB', { error: err.message });
      });
    } catch (err) {
      logger.error('chat_message handler error', { sessionId, error: err.message, stack: err.stack });
      socket.emit('chat_response', {
        chunk: 'Sorry, I encountered an error processing your request. Please try again.',
        done: true,
      });
    }
  });

  // ─── lead_form_submit ────────────────────────────────────────────────────────
  socket.on('lead_form_submit', async (data) => {
    try {
      const { name, email, phone, requirement, intent, pageUrl } = data || {};

      if (!email) {
        socket.emit('error', { message: 'lead_form_submit: email is required' });
        return;
      }

      logger.info(`Lead form submitted for session ${sessionId}`, { email, intent });

      const lead = await saveLead({
        sessionId,
        name,
        email,
        phone,
        requirement,
        intent,
        pageUrl,
      });

      sessionManager.updateLeadData(sessionId, { name, email, phone, requirement, intent });

      socket.emit('lead_saved', {
        success: true,
        leadId: lead.id,
        message: "Thanks! We've received your details and will be in touch shortly.",
      });
    } catch (err) {
      logger.error('lead_form_submit handler error', { sessionId, error: err.message });
      socket.emit('error', { message: 'Failed to save your details. Please try again.' });
    }
  });

  // ─── Disconnect ──────────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    logger.info(`Socket disconnected: ${socket.id}`, { sessionId, reason });
    // Note: we intentionally do NOT destroy the session on disconnect
    // so the user can reconnect (e.g., page navigation) within TTL window
  });
}

module.exports = { attachChatHandlers };
