'use strict';
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../common/config');
const logger = require('../../common/utils/logger');

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

/**
 * Gemini AI service.
 *
 * Maintains per-session conversation history in memory.
 * Each session has a history array: Array<{role: 'user'|'model', parts: [{text}]}>
 *
 * History is capped at MAX_HISTORY_TURNS to prevent runaway token growth.
 */

const MAX_HISTORY_TURNS = 20; // user + model pairs

/** @type {Map<string, Array>} */
const historyStore = new Map();

// ─── Prompt Builder ────────────────────────────────────────────────────────────

/**
 * Build the system-style prompt injected at the start of each turn.
 * Gemini 1.5 Flash doesn't have a separate system instruction field via basic API,
 * so we prepend context as a user message pair.
 *
 * @param {string} retrievedContext  Relevant page excerpts from RAG
 * @param {string} question  The user's current question
 * @returns {string}
 */
function buildPrompt(retrievedContext, question) {
  const contextSection = retrievedContext
    ? `Context from the current page:\n\n${retrievedContext}`
    : 'No specific page context is available for this question.';

  return `You are a helpful website assistant for this page. Your role is to answer visitor questions using ONLY the provided page context below.

Rules:
- For simple greetings (e.g. "hi", "hello", "hey") or general pleasantries, respond with a polite welcome and ask how you can help them.
- Answer questions using ONLY the provided context.
- If the answer is not in the context (and it's not a greeting/pleasantry), say exactly: "I cannot find that information on the current page."
- Be concise, friendly, and professional.
- Do not hallucinate or use external knowledge.
- Format your response clearly. Use bullet points or numbered lists when listing features or steps.

${contextSection}

---

User Question: ${question}`;
}

/**
 * Build a voice-optimised prompt that instructs Gemini to keep the answer
 * short and spoken-friendly (no markdown, ≤100 words) so TTS stays fast.
 *
 * @param {string} retrievedContext  Relevant page excerpts from RAG
 * @param {string} question  The user's current question
 * @returns {string}
 */
function buildVoicePrompt(retrievedContext, question) {
  const contextSection = retrievedContext
    ? `Context from the current page:\n\n${retrievedContext}`
    : 'No specific page context is available for this question.';

  return `You are a helpful voice assistant for this website. Answer the visitor's question using ONLY the provided page context.

CRITICAL RULES for voice responses:
- For simple greetings (e.g. "hi", "hello", "hey") or general pleasantries, respond with a polite welcome and ask how you can help them.
- Keep your answer to 2-3 sentences maximum (under 80 words).
- Cover all key points but be brief — this will be read aloud.
- Do NOT use markdown, bullet points, asterisks, or numbered lists.
- Write in natural spoken English, as if talking to someone.
- If the answer is not in the context (and it is not a greeting/pleasantry), say: "I cannot find that information on this page."
- Do not hallucinate or use external knowledge.

${contextSection}

---

User Question: ${question}`;
}

// ─── History Management ────────────────────────────────────────────────────────

/**
 * Get conversation history for a session (creates empty if none).
 * @param {string} sessionId
 * @returns {Array}
 */
function getHistory(sessionId) {
  if (!historyStore.has(sessionId)) {
    historyStore.set(sessionId, []);
  }
  return historyStore.get(sessionId);
}

/**
 * Append a user/model exchange to the history.
 * Prunes oldest pairs if MAX_HISTORY_TURNS is exceeded.
 * @param {string} sessionId
 * @param {string} userText
 * @param {string} modelText
 */
function appendHistory(sessionId, userText, modelText) {
  const history = getHistory(sessionId);
  history.push(
    { role: 'user',  parts: [{ text: userText  }] },
    { role: 'model', parts: [{ text: modelText }] }
  );
  // Keep only the last MAX_HISTORY_TURNS pairs (2 entries per pair)
  const maxEntries = MAX_HISTORY_TURNS * 2;
  if (history.length > maxEntries) {
    history.splice(0, history.length - maxEntries);
  }
}

/**
 * Clear conversation history for a session.
 * @param {string} sessionId
 */
function clearHistory(sessionId) {
  historyStore.delete(sessionId);
}

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Send a single message to Gemini and return the full text response.
 * Preserves multi-turn conversation history.
 *
 * @param {string} sessionId
 * @param {string} retrievedContext
 * @param {string} question
 * @returns {Promise<string>}
 */
async function sendMessage(sessionId, retrievedContext, question) {
  const model = genAI.getGenerativeModel({ model: config.geminiChatModel });
  const history = getHistory(sessionId);

  const chat = model.startChat({ history });
  const prompt = buildPrompt(retrievedContext, question);

  try {
    const result = await chat.sendMessage(prompt);
    const responseText = result.response.text();
    appendHistory(sessionId, question, responseText);
    logger.debug(`Gemini response for session ${sessionId}`, { length: responseText.length });
    return responseText;
  } catch (err) {
    logger.error('Gemini sendMessage failed', { sessionId, error: err.message });
    throw err;
  }
}

/**
 * Stream a response from Gemini, calling `onChunk` with each text delta.
 * Accumulates the full response and saves to history when streaming ends.
 *
 * @param {string} sessionId
 * @param {string} retrievedContext
 * @param {string} question
 * @param {(chunk: string) => void} onChunk  Called for each streamed text delta
 * @returns {Promise<string>}  Full accumulated response
 */
async function streamResponse(sessionId, retrievedContext, question, onChunk) {
  const model = genAI.getGenerativeModel({ model: config.geminiChatModel });
  const history = getHistory(sessionId);

  const chat = model.startChat({ history });
  const prompt = buildPrompt(retrievedContext, question);

  let fullResponse = '';

  try {
    const result = await chat.sendMessageStream(prompt);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        fullResponse += text;
        onChunk(text);
      }
    }

    appendHistory(sessionId, question, fullResponse);
    logger.debug(`Gemini stream complete for session ${sessionId}`, { totalLength: fullResponse.length });
    return fullResponse;
  } catch (err) {
    logger.error('Gemini streamResponse failed', { sessionId, error: err.message });
    throw err;
  }
}

/**
 * Stream a voice-optimised response from Gemini (short, spoken-friendly).
 * Uses buildVoicePrompt to enforce brevity for TTS.
 *
 * @param {string} sessionId
 * @param {string} retrievedContext
 * @param {string} question
 * @param {(chunk: string) => void} onChunk  Called for each streamed text delta
 * @returns {Promise<string>}  Full accumulated response
 */
async function streamResponseForVoice(sessionId, retrievedContext, question, onChunk) {
  const model = genAI.getGenerativeModel({ model: config.geminiChatModel });
  const history = getHistory(sessionId);

  const chat = model.startChat({ history });
  const prompt = buildVoicePrompt(retrievedContext, question);

  let fullResponse = '';

  try {
    const result = await chat.sendMessageStream(prompt);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        fullResponse += text;
        onChunk(text);
      }
    }

    appendHistory(sessionId, question, fullResponse);
    logger.debug(`Gemini voice stream complete for session ${sessionId}`, { totalLength: fullResponse.length });
    return fullResponse;
  } catch (err) {
    logger.error('Gemini streamResponseForVoice failed', { sessionId, error: err.message });
    throw err;
  }
}

module.exports = { sendMessage, streamResponse, streamResponseForVoice, buildPrompt, buildVoicePrompt, getHistory, clearHistory, appendHistory };
