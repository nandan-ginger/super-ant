'use strict';
const express = require('express');
const router = express.Router();
const geminiService = require('../services/gemini');
const leadDetector = require('../services/leadDetector');
const retriever = require('../rag/retriever');
const sessionManager = require('../services/sessionManager');
const { saveMessage } = require('../queries/messages');
const { upsertSession } = require('../queries/sessions');
const logger = require('../../common/utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /api/chat
 *
 * REST fallback for environments where Socket.IO is unavailable.
 * Returns a full (non-streamed) response.
 *
 * Body:
 *   {
 *     sessionId?: string,    // reuse an existing session or omit to create new
 *     widgetCode: string,
 *     message: string,
 *     pageContext?: object   // optional, used if session has no context yet
 *   }
 */
router.post('/', async (req, res) => {
  const { message, widgetCode, pageContext } = req.body;
  let { sessionId } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    sessionId = sessionId || uuidv4();

    // Ensure session exists
    sessionManager.createOrRefreshSession(sessionId, {
      widgetCode: widgetCode || 'rest-client',
      pageUrl: pageContext?.url,
      pageTitle: pageContext?.title,
    });

    await upsertSession({
      id: sessionId,
      widgetCode: widgetCode || 'rest-client',
      pageUrl: pageContext?.url,
      pageTitle: pageContext?.title,
    });

    // Index context if provided and not already indexed
    if (pageContext) {
      const { strategy, chunkCount } = await retriever.indexPageContext(sessionId, pageContext);
      sessionManager.updatePageContext(sessionId, pageContext, strategy);
      logger.debug(`REST /api/chat: indexed page`, { sessionId, strategy, chunkCount });
    }

    // Lead detection
    const { leadDetected, intent } = leadDetector.detectLeadIntent(message);

    // Retrieve context
    const storedContext = sessionManager.getPageContext(sessionId);
    const { context: retrievedContext } = await retriever.retrieveContext(
      sessionId,
      message,
      storedContext || pageContext
    );

    // Get full Gemini response (non-streaming for REST)
    const response = await geminiService.sendMessage(sessionId, retrievedContext, message);

    // Persist messages
    await Promise.allSettled([
      saveMessage({ sessionId, role: 'user', content: message }),
      saveMessage({ sessionId, role: 'assistant', content: response }),
    ]);

    return res.json({
      sessionId,
      response,
      leadDetected,
      intent: leadDetected ? intent : null,
    });
  } catch (err) {
    logger.error('POST /api/chat error', { error: err.message });
    return res.status(500).json({ error: 'Failed to process message. Please try again.' });
  }
});

module.exports = router;
