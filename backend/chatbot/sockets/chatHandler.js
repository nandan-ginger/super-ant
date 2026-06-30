'use strict';
const logger = require('../../common/utils/logger');
const config = require('../../common/config');
const sessionManager = require('../services/sessionManager');
const geminiService = require('../services/gemini');
const voiceService = require('../services/voiceService');
const leadDetector = require('../services/leadDetector');
const retriever = require('../rag/retriever');
const { upsertSession, touchSession: dbTouchSession } = require('../queries/sessions');
const { saveMessage } = require('../queries/messages');
const { saveLead } = require('../queries/leads');
const { widgetExists } = require('../queries/widgets');
const { getPageRuleByPath } = require('../queries/pageRules');

// ─── Widget Code Validation Cache ────────────────────────────────────────────
// Cache valid widget codes in memory to avoid a DB hit on every socket connect.
// TTL: 5 minutes. Entries are simple { validatedAt: timestamp } objects.
const WIDGET_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const validWidgetCache = new Map(); // widgetCode -> { validatedAt }

/**
 * Check if a widget code is valid, using an in-memory cache.
 * Returns true if valid (in cache and not expired, or confirmed from DB).
 * Returns false for unknown / invalid codes.
 * Special: 'demo_widget_001' and 'rest-client' are always allowed (legacy).
 */
async function isValidWidgetCode(widgetCode) {
  // Allow legacy/test codes without a DB lookup
  if (widgetCode === 'demo_widget_001' || widgetCode === 'rest-client' || widgetCode === 'unknown') {
    return true;
  }

  const cached = validWidgetCache.get(widgetCode);
  if (cached && (Date.now() - cached.validatedAt) < WIDGET_CACHE_TTL_MS) {
    return true; // still fresh
  }

  // Hit the DB
  try {
    const exists = await widgetExists(widgetCode);
    if (exists) {
      validWidgetCache.set(widgetCode, { validatedAt: Date.now() });
    } else {
      validWidgetCache.delete(widgetCode); // remove stale entry if it was cached before
    }
    return exists;
  } catch (err) {
    logger.error('Widget validation DB error', { widgetCode, error: err.message });
    // Fail open on DB errors to avoid disrupting existing sessions
    return true;
  }
}


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

  // ─── Widget Code Validation ─────────────────────────────────────────────────
  // Validate at connect time only (not per-message) to keep performance high.
  // Unregistered widget codes are disconnected immediately.
  isValidWidgetCode(widgetCode).then(valid => {
    if (!valid) {
      logger.warn(`Socket rejected: unknown widgetCode "${widgetCode}"`, { sessionId, ip: socket.handshake.address });
      socket.emit('error', { message: 'Unregistered widget. Please check your widget code.' });
      socket.disconnect(true);
      return;
    }
    // Create an in-memory session immediately
    sessionManager.createOrRefreshSession(sessionId, { widgetCode });
  }).catch(() => {
    // On unexpected error, allow connection but log it
    sessionManager.createOrRefreshSession(sessionId, { widgetCode });
  });

  // Also create session immediately for known/cached codes (avoids delay)
  if (validWidgetCache.has(widgetCode) || widgetCode === 'demo_widget_001' || widgetCode === 'rest-client') {
    sessionManager.createOrRefreshSession(sessionId, { widgetCode });
  }

  // ─── context_update ─────────────────────────────────────────────────────────
  socket.on('context_update', async (data) => {
    try {
      const { pageContext } = data || {};

      logger.info(`context_update received for session ${sessionId}`, {
        title: pageContext?.title,
        url: pageContext?.url,
      });

      if (!pageContext) {
        socket.emit('error', { message: 'context_update: pageContext is required' });
        return;
      }

      // ── Lookup matching page rule for this URL (exact pathname match) ──────────
      if (pageContext.url) {
        try {
          const pathname = new URL(pageContext.url).pathname;
          const matchedRule = await getPageRuleByPath(widgetCode, pathname);
          sessionManager.updateMatchedPageRule(sessionId, matchedRule);
          if (matchedRule) {
            logger.info(`Page rule matched for session ${sessionId}`, {
              urlPath: matchedRule.urlPath,
              contextOnlyMode: matchedRule.contextOnlyMode,
              hasStaticContext: !!matchedRule.staticContext,
              popupDelay: matchedRule.popupDelaySeconds,
            });
          }
        } catch (urlErr) {
          logger.warn(`Failed to parse URL for page rule lookup`, { url: pageContext.url, error: urlErr.message });
        }
      }

      // Persist session metadata in MongoDB (URL, title — no embedding yet)
      await upsertSession({
        id: sessionId,
        widgetCode,
        pageUrl: pageContext.url,
        pageTitle: pageContext.title,
      });

      // Store raw page context in memory — embeddings are built lazily on first chat_message
      sessionManager.createOrRefreshSession(sessionId, { widgetCode });
      sessionManager.updatePageContext(sessionId, pageContext, 'pending');

      logger.info(`Page context stored (not yet embedded) for session ${sessionId}`);

      // Tell the widget the context is stored and it can show "Ready"
      socket.emit('context_ready');

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
      const session = sessionManager.getSession(sessionId);
      if (leadDetected) {
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
      // session already declared above for lead detection
      const matchedPageRule = session?.matchedPageRule || null;

      // Build static context from page rule (if any)
      const staticContext = (matchedPageRule?.staticContext) || '';
      const contextOnlyMode = !!(matchedPageRule?.contextOnlyMode && staticContext);


      // ── If context-only mode: skip RAG entirely, use only admin context ───────
      if (contextOnlyMode) {
        logger.debug(`[CONTEXT-ONLY] Skipping RAG — using admin static context for session ${sessionId}`);
        trackApiCall('streamResponse (Gemini Chat API)', { model: config.geminiChatModel, reason: 'generate reply (static context only)', mode: audio ? 'voice' : 'text' });
        let fullResponse = '';
        await streamFn(
          sessionId,
          staticContext,
          userMessage,
          (chunk) => {
            fullResponse += chunk;
            socket.emit('chat_response', { chunk, done: false });
          }
        );
        socket.emit('chat_response', { chunk: '', done: true });
        if (audio) {
          trackApiCall('synthesize (Gemini TTS API)', { model: 'gemini-3.1-flash-tts-preview', language: language || 'en' });
          try {
            const base64Audio = await voiceService.synthesize(fullResponse, language || 'en');
            socket.emit('voice_response', { audio: base64Audio });
          } catch (synthErr) {
            socket.emit('voice_response_failed', { error: synthErr.message });
          }
        }
        await saveMessage({ sessionId, role: 'assistant', content: fullResponse }).catch(() => {});
        logger.info(`[MSG-END] Static-context reply complete`, { sessionId, responseLength: fullResponse.length });
        return;
      }

      // ── If no page context at all: request client to re-scrape ─────────────────
      if (!pageContext) {
        logger.warn(`Session ${sessionId} has no page context — requesting re-scrape from client`);
        socket.emit('context_required', { reason: 'session_expired' });
        socket.emit('chat_response', { chunk: '', done: true });
        return;
      }

      // ── Lazy embedding: create embeddings now on first message if not yet done ───
      const store = require('../rag/store');
      let hasChunks = store.hasChunks(sessionId);

      if (!hasChunks) {
        // This is the user's first message — embed the stored raw page context now
        logger.info(`Lazy embedding: indexing page context on first message for session ${sessionId}`);
        trackApiCall('indexPageContext (Gemini Embedding API)', { reason: 'lazy embed on first user message' });
        try {
          const { strategy, chunkCount } = await retriever.indexPageContext(sessionId, pageContext);
          sessionManager.updatePageContext(sessionId, pageContext, strategy);
          hasChunks = store.hasChunks(sessionId);
          logger.info(`Lazy embed complete for session ${sessionId}`, { strategy, chunkCount });
          // Notify widget embeddings are done (fires pending message retry if needed)
          socket.emit('context_indexed', { strategy, chunkCount });
        } catch (embedErr) {
          logger.error('Lazy embedding failed — falling back to direct text', { sessionId, error: embedErr.message });
          // Fall through — retrieveContext will use direct fallback
        }
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

      // Merge admin static context (if configured) with RAG-retrieved context
      const finalContext = staticContext
        ? `[Admin-configured page context]\n${staticContext}\n\n---\n\n${retrievedContext}`
        : retrievedContext;

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
        finalContext,
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
