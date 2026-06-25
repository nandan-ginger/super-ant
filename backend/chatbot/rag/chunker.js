'use strict';
const { estimateTokens } = require('../../common/utils/tokenCounter');

/**
 * Text chunker for RAG.
 *
 * Strategy:
 *   1. Split text into sentences (by ". " / "? " / "! " / newlines).
 *   2. Group sentences into chunks of ~targetWords words.
 *   3. Apply an overlap of overlapWords between consecutive chunks.
 *   4. Prepend the nearest preceding heading to each chunk for context.
 */

const TARGET_WORDS = 380;   // ≈ 500 tokens
const OVERLAP_WORDS = 50;   // ≈ 65 tokens of overlap between chunks

/**
 * Split text into sentences.
 * @param {string} text
 * @returns {string[]}
 */
function splitSentences(text) {
  // Split on sentence-ending punctuation followed by whitespace or end-of-string
  return text
    .split(/(?<=[.?!])\s+|\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Chunk a page context object into overlapping text segments.
 *
 * @param {object} pageContext  Structured page context from the widget
 * @param {string} pageContext.title
 * @param {string} pageContext.url
 * @param {string[]} pageContext.headings
 * @param {string} pageContext.visibleText
 * @param {string[]} [pageContext.tables]
 * @returns {Array<{id: number, text: string, heading: string, tokens: number}>}
 */
function chunkPageContext(pageContext) {
  const chunks = [];
  const { title = '', url = '', headings = [], visibleText = '', tables = [] } = pageContext;

  // Build the full text corpus with heading markers so we can track context
  let corpus = visibleText || '';
  if (tables && tables.length > 0) {
    corpus += '\n\n' + tables.join('\n\n');
  }

  if (!corpus.trim()) return chunks;

  const sentences = splitSentences(corpus);
  let currentWords = [];
  let currentHeading = title || 'Introduction';
  let chunkIndex = 0;
  let overlapBuffer = [];

  const flushChunk = () => {
    const text = currentWords.join(' ').trim();
    if (!text) return;

    chunks.push({
      id: chunkIndex++,
      text,
      heading: currentHeading,
      pageTitle: title,
      pageUrl: url,
      tokens: estimateTokens(text),
    });

    // Carry last overlapWords words into next chunk for continuity
    overlapBuffer = currentWords.slice(-OVERLAP_WORDS);
    currentWords = [...overlapBuffer];
  };

  for (const sentence of sentences) {
    // Detect heading markers (short sentences that appear in pageContext.headings)
    const isHeading = headings.some(
      (h) => h && sentence.toLowerCase().includes(h.toLowerCase().slice(0, 30))
    );
    if (isHeading && currentWords.length > 0) {
      flushChunk();
      currentHeading = sentence;
    }

    const words = sentence.split(/\s+/).filter(Boolean);
    currentWords.push(...words);

    if (currentWords.length >= TARGET_WORDS) {
      flushChunk();
    }
  }

  // Flush remaining content
  if (currentWords.length > OVERLAP_WORDS) {
    flushChunk();
  }

  return chunks;
}

module.exports = { chunkPageContext, TARGET_WORDS, OVERLAP_WORDS };
