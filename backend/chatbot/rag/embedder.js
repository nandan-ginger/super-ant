'use strict';
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../common/config');
const logger = require('../../common/utils/logger');

const genAI = new GoogleGenerativeAI(config.geminiApiKey);
const embeddingModel = genAI.getGenerativeModel({ model: config.geminiEmbeddingModel });

// NOTE: genAI and embeddingModel are class instances — logging them directly
// always shows {} because their properties are non-enumerable.
// Log the actual values that matter instead:
logger.info('Embedder initialised', {
  apiKeyLoaded: !!config.geminiApiKey,
  apiKeyMasked: config.geminiApiKey
    ? `${config.geminiApiKey.slice(0, 4)}...${config.geminiApiKey.slice(-4)}`
    : 'NOT SET ❌',
  embeddingModel: config.geminiEmbeddingModel,
  genAIConstructed: genAI.constructor.name,          // "GoogleGenerativeAI"
  embeddingModelName: embeddingModel.model,          // the model string
});

const BATCH_SIZE = 20; // Gemini supports batching up to 100; keep conservative

/**
 * Generate an embedding vector for a single text string.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedText(text) {
  try {
    // logger.info('Embedding text: ', { text });
    const result = await embeddingModel.embedContent(text);

    return result.embedding.values;
  } catch (err) {
    logger.error('Embedding failed for text', { error: err.message, textSnippet: text.slice(0, 80) });
    throw err;
  }
}

/**
 * Embed an array of chunk objects in batches.
 * Each chunk must have a `text` field.
 * Returns the same chunks with an `embedding` field added.
 *
 * @param {Array<{text: string, [key: string]: any}>} chunks
 * @returns {Promise<Array<{embedding: number[], [key: string]: any}>>}
 */
async function embedChunks(chunks) {
  const results = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    logger.debug(`Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}`, { size: batch.length });

    // Process batch in parallel (each request is independent)
    const embeddings = await Promise.all(
      batch.map(async (chunk) => {
        const vector = await embedText(chunk.text);
        return { ...chunk, embedding: vector };
      })
    );

    results.push(...embeddings);
  }

  logger.debug(`Embedded ${results.length} chunks`);
  return results;
}

/**
 * Embed a query string for similarity search.
 * @param {string} query
 * @returns {Promise<number[]>}
 */
async function embedQuery(query) {
  return embedText(query);
}

module.exports = { embedChunks, embedQuery, embedText };
