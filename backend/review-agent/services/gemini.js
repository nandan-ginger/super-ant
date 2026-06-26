'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../common/config');
const { retry } = require('../utils/retry');
const logger = require('../../common/utils/logger');

// ---------------------------------------------------------------------------
// Gemini Service — AI-powered review analysis using Gemini API
// ---------------------------------------------------------------------------

let genAI = null;
let model = null;

/**
 * Initialize and return the Gemini generative model instance.
 * Uses lazy initialization so the API key is read from config at call time.
 *
 * @returns {import('@google/generative-ai').GenerativeModel}
 */
function getGeminiModel() {
  if (model) return model;

  const apiKey = config.geminiApiKey;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in config/environment variables');
  }

  // Fallback to gemini-2.5-flash if needed, or use the configured model name.
  const modelName = process.env.GEMINI_MODEL || config.geminiChatModel || 'gemini-2.5-flash';

  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.4,        // Lower temperature for consistent, professional responses
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json', // Request JSON output directly
    },
  });

  logger.info('Review Agent: Gemini model initialized', { model: modelName });
  return model;
}

/**
 * The analysis prompt sent to Gemini for each review.
 * Returns structured JSON with sentiment, concern, and reply.
 */
const ANALYSIS_PROMPT = `You are a customer experience expert for Ginger Consultancy Services LLP.

Analyze the following review.

Review:
"{reviewText}"

Classify sentiment into one of:
- positive
- neutral
- negative
- critical

Detect if the customer has concerns.

Concern categories:
- service
- staff
- pricing
- communication
- quality
- billing
- delivery
- technical
- general

Generate a professional response.

Rules:
- If positive: Generate an appreciation response.
- If neutral: Generate an acknowledgement response.
- If negative: Generate an apology and improvement response.
- If critical: Generate an escalation response asking the customer to contact support@gingerconsultancy.com

Do not use markdown.
Return JSON only.

Required Format:
{
  "sentiment": "positive",
  "concern": false,
  "concernType": "general",
  "confidence": 0.98,
  "requiresEscalation": false,
  "reply": "Thank you for your valuable feedback."
}

No explanation.
No markdown.
Only JSON.`;

const VALID_SENTIMENTS = ['positive', 'neutral', 'negative', 'critical'];

const VALID_CONCERN_TYPES = [
  'service', 'staff', 'pricing', 'communication',
  'quality', 'billing', 'delivery', 'technical', 'general',
];

/**
 * Analyze a review using Gemini.
 *
 * @param {string} reviewText — The review text to analyze.
 * @returns {Promise<Object>} — Parsed analysis result.
 */
async function analyzeReview(reviewText) {
  if (!reviewText || reviewText.trim().length === 0) {
    logger.info('Empty review text — using default positive analysis');
    return {
      sentiment: 'positive',
      concern: false,
      concernType: 'general',
      confidence: 0.5,
      requiresEscalation: false,
      reply: 'Thank you for your rating! We appreciate your feedback.',
    };
  }

  const prompt = ANALYSIS_PROMPT.replace('{reviewText}', sanitizeForPrompt(reviewText));

  const result = await retry(
    async () => {
      const modelInstance = getGeminiModel();
      const response = await modelInstance.generateContent(prompt);
      const text = response.response.text();

      logger.debug('Gemini raw response', { text: text.substring(0, 200) });

      // Parse and validate the JSON response
      return parseGeminiResponse(text);
    },
    {
      retries: 3,
      baseDelayMs: 1500,
      label: 'Gemini analysis',
      shouldRetry: (err) => {
        // Retry on rate limiting or transient errors, not on parse errors
        const message = err.message || '';
        return (
          message.includes('429') ||
          message.includes('503') ||
          message.includes('RESOURCE_EXHAUSTED') ||
          message.includes('UNAVAILABLE')
        );
      },
    }
  );

  logger.info('Review analyzed successfully', {
    sentiment: result.sentiment,
    concern: result.concern,
    requiresEscalation: result.requiresEscalation,
    confidence: result.confidence,
  });

  return result;
}

/**
 * Parse and validate the JSON response from Gemini.
 * @private
 * @param {string} text — Raw text response from Gemini.
 * @returns {Object} — Validated analysis object.
 */
function parseGeminiResponse(text) {
  let parsed;

  try {
    // Try direct JSON parse first
    parsed = JSON.parse(text);
  } catch {
    // Try to extract JSON from the response (in case of markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from Gemini response');
    }
    parsed = JSON.parse(jsonMatch[0]);
  }

  // Validate and sanitize the response
  return {
    sentiment: VALID_SENTIMENTS.includes(parsed.sentiment) ? parsed.sentiment : 'neutral',
    concern: Boolean(parsed.concern),
    concernType: VALID_CONCERN_TYPES.includes(parsed.concernType)
      ? parsed.concernType
      : 'general',
    confidence: typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.5,
    requiresEscalation: Boolean(parsed.requiresEscalation),
    reply: typeof parsed.reply === 'string' && parsed.reply.length > 0
      ? parsed.reply
      : 'Thank you for your feedback. We value your input.',
  };
}

/**
 * Sanitize review text before embedding in the prompt.
 * Removes characters that could break the prompt structure.
 * @private
 * @param {string} text
 * @returns {string}
 */
function sanitizeForPrompt(text) {
  return text
    .replace(/"/g, '\\"')        // Escape quotes
    .replace(/\n/g, ' ')         // Replace newlines with spaces
    .replace(/[^\w\s.,!?;:'"@#$%&*()\-+=/\\]/g, '') // Remove unusual chars
    .trim()
    .substring(0, 2000);         // Cap at 2000 chars to stay within token limits
}

module.exports = { analyzeReview };
