'use strict';

const cron = require('node-cron');
const config = require('../../common/config');
const { processNewReviews } = require('../services/replyOrchestrator');
const logger = require('../../common/utils/logger');

// ---------------------------------------------------------------------------
// Review Polling Job — Cron-based scheduler for fetching new reviews
// ---------------------------------------------------------------------------

let scheduledTask = null;
let isRunning = false;

/**
 * Start the review polling cron job.
 *
 * Default schedule: every 5 minutes.
 * Can be overridden via REVIEW_POLL_CRON environment variable.
 */
function startReviewPolling() {
  const cronExpression = config.reviewAgent.pollCron || '*/5 * * * *';

  // Validate cron expression
  if (!cron.validate(cronExpression)) {
    logger.error('Invalid cron expression', { cronExpression });
    throw new Error(`Invalid cron expression: ${cronExpression}`);
  }

  scheduledTask = cron.schedule(cronExpression, async () => {
    // Prevent overlapping runs
    if (isRunning) {
      logger.warn('Previous review polling cycle still running — skipping this run');
      return;
    }

    isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Review polling cycle started');

      const summary = await processNewReviews();

      const duration = Date.now() - startTime;
      logger.info('Review polling cycle completed', {
        ...summary,
        durationMs: duration,
      });
    } catch (error) {
      logger.error('Review polling cycle failed', {
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime,
      });
    } finally {
      isRunning = false;
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata', // IST for Ginger Consultancy (India)
  });

  logger.info('Review polling job scheduled', { cronExpression, timezone: 'Asia/Kolkata' });
}

/**
 * Stop the review polling cron job.
 */
function stopReviewPolling() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger.info('Review polling job stopped');
  }
}

/**
 * Check if the polling job is currently running a cycle.
 * @returns {boolean}
 */
function isPollingRunning() {
  return isRunning;
}

module.exports = { startReviewPolling, stopReviewPolling, isPollingRunning };
