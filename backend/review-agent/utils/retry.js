'use strict';

const logger = require('../../common/utils/logger');

// ---------------------------------------------------------------------------
// Retry — Generic retry utility with exponential backoff
// ---------------------------------------------------------------------------

/**
 * Execute an async function with retry logic and exponential backoff.
 *
 * @param {Function}  fn              — Async function to execute.
 * @param {Object}    [options]       — Configuration options.
 * @param {number}    [options.retries=3]       — Max number of retry attempts.
 * @param {number}    [options.baseDelayMs=1000] — Base delay in milliseconds.
 * @param {number}    [options.maxDelayMs=30000]  — Maximum delay cap.
 * @param {number}    [options.factor=2]         — Exponential backoff factor.
 * @param {string}    [options.label='operation'] — Label for log messages.
 * @param {Function}  [options.shouldRetry]       — Predicate to decide retries.
 * @returns {Promise<*>} — Resolved value of fn.
 */
async function retry(fn, options = {}) {
  const {
    retries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    factor = 2,
    label = 'operation',
    shouldRetry = () => true,
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      // Check whether we should retry this specific error
      if (attempt > retries || !shouldRetry(error)) {
        logger.error(`[Retry] ${label} failed after ${attempt} attempt(s)`, {
          error: error.message,
          stack: error.stack,
        });
        throw error;
      }

      // Calculate delay with jitter
      const delay = Math.min(
        baseDelayMs * Math.pow(factor, attempt - 1) + Math.random() * 500,
        maxDelayMs
      );

      logger.warn(
        `[Retry] ${label} attempt ${attempt} failed — retrying in ${Math.round(delay)}ms`,
        { error: error.message }
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

module.exports = { retry };
