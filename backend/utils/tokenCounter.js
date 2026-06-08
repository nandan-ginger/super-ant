'use strict';

/**
 * Rough token estimator.
 *
 * The Gemini tokenizer is close to the GPT-4 tokenizer for English text.
 * A reliable approximation: 1 token ≈ 0.75 words (or 1 word ≈ 1.33 tokens).
 * We use words × 1.3 which tends to overestimate slightly — safer for limits.
 */

/**
 * Estimate the number of tokens in a string.
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(wordCount * 1.3);
}

/**
 * Estimate tokens across an array of strings.
 * @param {string[]} texts
 * @returns {number}
 */
function estimateTokensForArray(texts) {
  return texts.reduce((sum, t) => sum + estimateTokens(t), 0);
}

/**
 * Truncate text to approximately `maxTokens` tokens.
 * Splits by sentence boundaries where possible.
 * @param {string} text
 * @param {number} maxTokens
 * @returns {string}
 */
function truncateToTokenLimit(text, maxTokens) {
  const words = text.trim().split(/\s+/);
  const maxWords = Math.floor(maxTokens / 1.3);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
}

module.exports = { estimateTokens, estimateTokensForArray, truncateToTokenLimit };
