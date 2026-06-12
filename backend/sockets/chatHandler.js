'use strict';
const logger = require('../utils/logger');
const config = require('../config');
const sessionManager = require('../services/sessionManager');
const geminiService = require('../services/gemini');
const voiceService = require('../services/voiceService');
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
        hasPrecomputedChunks: !!data?.embeddedChunks,
      });

      const { pageContext, embeddedChunks } = data || {};

      // ── Fast path: client is re-uploading pre-computed embeddings from sessionStorage
      if (embeddedChunks && Array.isArray(embeddedChunks) && embeddedChunks.length > 0) {
        const store = require('../rag/store');
        store.addChunks(sessionId, embeddedChunks);

        // Restore session
        await upsertSession({
          id: sessionId,
          widgetCode,
          pageUrl: pageContext?.url,
          pageTitle: pageContext?.title,
        }).catch(() => {});

        sessionManager.createOrRefreshSession(sessionId, { widgetCode });
        if (pageContext) {
          sessionManager.updatePageContext(sessionId, pageContext, 'rag');
        }

        logger.info(`Session ${sessionId} restored from client-cached embeddings`, { chunkCount: embeddedChunks.length });
        socket.emit('context_indexed', {
          strategy: 'rag',
          chunkCount: embeddedChunks.length,
          message: 'Context restored from cache.',
          restoredFromCache: true,
        });
        return;
      }

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

      // Retrieve the embedded chunks to send back to client for caching
      const store = require('../rag/store');
      const embeddedChunksToCache = store.getChunks ? store.getChunks(sessionId) : null;

      logger.info(`Page indexed for session ${sessionId}`, { strategy, chunkCount });

      socket.emit('context_indexed', {
        strategy,
        chunkCount,
        message: `Page indexed successfully using "${strategy}" strategy.`,
        // Send back embedded chunks so client can cache them in sessionStorage
        embeddedChunks: embeddedChunksToCache,
      });
    } catch (err) {
      logger.error('context_update handler error', { sessionId, error: err.message });
      socket.emit('error', { message: 'Failed to process page context. Please try again.' });
    }
  });

  // ─── chat_message ────────────────────────────────────────────────────────────
  socket.on('chat_message', async (data) => {
    try {
      const { message, audio, mimeType, language } = data || {};
      
      if ((!message || typeof message !== 'string' || !message.trim()) && !audio) {
        socket.emit('error', { message: 'chat_message: message or audio field is required' });
        return;
      }

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
        hasAudio: !!audio,
        messageLength: message?.length || 0,
      });
      // ─────────────────────────────────────────────────────────────────────────

      let userMessage = (message || '').trim();

      // If audio is provided, transcribe it first
      if (audio) {
        trackApiCall('transcribe (Gemini Chat/Understanding API)', { mimeType });
        userMessage = await voiceService.transcribe(audio, mimeType);
        
        if (!userMessage) {
          socket.emit('error', { message: 'Failed to understand the audio. Please speak clearly.' });
          return;
        }

        // Send the transcription to the client so it can display the user bubble
        socket.emit('transcription_complete', { text: userMessage });
      }

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

      // ── If session expired and no embeddings: ask client to re-upload their cached chunks
      if (!hasChunks && !pageContext) {
        logger.warn(`Session ${sessionId} has no embeddings and no page context — requesting context from client`);
        socket.emit('context_required', { reason: 'session_expired' });
        // Hold the current message — client will re-upload then the user can resend
        socket.emit('chat_response', { chunk: '', done: true });
        return;
      }

      logger.debug(`[DEBUG] retriever.retrieveContext called`, {
        sessionId,
        hasEmbeddings: hasChunks,
        willEmbedQuery: hasChunks,
      });
      if (hasChunks) trackApiCall('embedQuery (Gemini Embedding API)', { model: 'text-embedding-004', reason: 'similarity search for RAG' });

      const { context: retrievedContext, strategy } = await retriever.retrieveContext(
        sessionId,
        userMessage,
        pageContext
      );
      logger.debug(`[DEBUG] retrieveContext returned`, { sessionId, strategy, contextLength: retrievedContext?.length || 0 });

      // ── Gemini streaming response ────────────────────────────────────────────
      // For voice queries use the voice-optimised prompt (shorter, no markdown)
      // so TTS stays fast and doesn't time out.
      const streamFn = audio
        ? geminiService.streamResponseForVoice
        : geminiService.streamResponse;

      trackApiCall('streamResponse (Gemini Chat API)', { model: config.geminiChatModel, reason: 'generate assistant reply', mode: audio ? 'voice' : 'text' });
      let fullResponse = '';

      await streamFn(
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

      // If the user query was audio, generate the synthesized audio response
      if (audio) {
        trackApiCall('synthesize (Gemini TTS API)', { model: 'gemini-3.1-flash-tts-preview', language: language || 'en' });
        try {
          const base64Audio = await voiceService.synthesize(fullResponse, language || 'en');
          socket.emit('voice_response', { audio: base64Audio });
        } catch (synthErr) {
          logger.error('Failed to synthesize response speech', { sessionId, error: synthErr.message });
          socket.emit('voice_response_failed', { error: synthErr.message });
        }
      }

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
      socket.emit('error', { message: 'The bot is under issue, please come back later.' });
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
