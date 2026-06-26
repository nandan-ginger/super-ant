'use strict';

const config = require('../../common/config');
const logger = require('../../common/utils/logger');
const Review = require('../models/Review');
const ReviewReply = require('../models/ReviewReply');
const { analyzeReview } = require('./gemini');
const { sendEscalationEmail } = require('./email');

// Import all adapters
const GoogleReviewAdapter = require('../adapters/GoogleReviewAdapter');
const ReviewTreasuresAdapter = require('../adapters/ReviewTreasuresAdapter');
const FacebookReviewAdapter = require('../adapters/FacebookReviewAdapter');
const TrustPilotAdapter = require('../adapters/TrustPilotAdapter');
const YelpAdapter = require('../adapters/YelpAdapter');

// Instantiate adapters
const adapters = {
  google: new GoogleReviewAdapter(),
  reviewtreasures: new ReviewTreasuresAdapter(),
  facebook: new FacebookReviewAdapter(),
  trustpilot: new TrustPilotAdapter(),
  yelp: new YelpAdapter(),
};

/**
 * Main pipeline: fetch new reviews from all platforms, deduplicate, analyze with Gemini,
 * auto-reply where appropriate, and send escalation emails for critical reviews.
 *
 * Called by the cron job on a regular schedule.
 *
 * @returns {Promise<Object>} — Summary of processing results across all adapters.
 */
async function processNewReviews() {
  const summary = {
    fetched: 0,
    newReviews: 0,
    duplicates: 0,
    analyzed: 0,
    repliesPosted: 0,
    escalations: 0,
    errors: 0,
  };

  logger.info('Starting review fetching cycle for all platforms');

  for (const [sourceKey, adapter] of Object.entries(adapters)) {
    try {
      logger.info(`Fetching reviews from platform: ${sourceKey}`);
      // Google needs page size or token; stubs ignore it.
      const reviews = await adapter.fetchReviews({ pageSize: 50 });
      summary.fetched += reviews.length;

      if (reviews.length > 0) {
        logger.info(`Fetched ${reviews.length} reviews from ${sourceKey}`);
        for (const normalizedReview of reviews) {
          try {
            await processSingleReview(normalizedReview, sourceKey, summary);
          } catch (error) {
            summary.errors++;
            logger.error(`Error processing individual review from ${sourceKey}`, {
              reviewId: normalizedReview.reviewId,
              error: error.message,
              stack: error.stack,
            });
          }
        }
      } else {
        logger.info(`No reviews fetched from platform: ${sourceKey}`);
      }
    } catch (adapterError) {
      summary.errors++;
      logger.error(`Failed to fetch/process reviews for adapter: ${sourceKey}`, {
        error: adapterError.message,
        stack: adapterError.stack,
      });
    }
  }

  logger.info('Review processing cycle completed', summary);
  return summary;
}

/**
 * Process a single normalized review through the full pipeline.
 *
 * @param {Object} normalizedReview — Review in normalized adapter format.
 * @param {string} sourceKey        — Source identifier (e.g., 'google').
 * @param {Object} summary          — Running summary counters.
 */
async function processSingleReview(normalizedReview, sourceKey, summary) {
  const { reviewId } = normalizedReview;

  // Deduplication check
  const existingReview = await Review.findOne({ reviewId });
  if (existingReview) {
    summary.duplicates++;
    logger.debug('Duplicate review skipped', { reviewId });
    return;
  }

  summary.newReviews++;
  logger.info('New review detected', {
    reviewId,
    authorName: normalizedReview.authorName,
    rating: normalizedReview.rating,
    source: sourceKey,
  });

  // Calculate location ID depending on the source
  let locationId = 'default';
  if (sourceKey === 'google') {
    locationId = `${config.reviewAgent.google.accountId}/${config.reviewAgent.google.locationId}`;
  }

  // Store the review in MongoDB with pending analysis status
  const review = await Review.create({
    reviewId: normalizedReview.reviewId,
    locationId,
    source: sourceKey,
    authorName: normalizedReview.authorName,
    profilePhotoUrl: normalizedReview.profilePhotoUrl || '',
    starRating: normalizedReview.rating,
    comment: normalizedReview.comment,
    reviewCreatedAt: normalizedReview.createdAt,
    analysisStatus: 'processing',
  });

  logger.info('Review stored in database', { reviewId, mongoId: review._id });

  // Analyze with Gemini AI
  try {
    const analysis = await analyzeReview(normalizedReview.comment);

    // Update the review with analysis results
    review.sentiment = analysis.sentiment;
    review.concern = analysis.concern;
    review.concernType = analysis.concernType;
    review.confidence = analysis.confidence;
    review.requiresEscalation = analysis.requiresEscalation;
    review.generatedReply = analysis.reply;
    review.analysisStatus = 'completed';
    review.processedAt = new Date();

    await review.save();
    summary.analyzed++;

    logger.info('Review analyzed by Gemini', {
      reviewId,
      sentiment: analysis.sentiment,
      requiresEscalation: analysis.requiresEscalation,
    });

    // Auto-reply if not escalation
    if (!analysis.requiresEscalation) {
      try {
        await postReplyToReview(review);
        summary.repliesPosted++;
      } catch (replyError) {
        logger.error('Failed to post auto-reply', {
          reviewId,
          error: replyError.message,
        });
      }
    }

    // Send escalation email if needed
    if (analysis.requiresEscalation) {
      try {
        await sendEscalationEmail(review);
        review.escalationNotified = true;
        await review.save();
        summary.escalations++;
        logger.info('Escalation email sent', { reviewId });
      } catch (emailError) {
        logger.error('Failed to send escalation email', {
          reviewId,
          error: emailError.message,
        });
      }
    }
  } catch (analysisError) {
    review.analysisStatus = 'failed';
    review.analysisError = analysisError.message;
    await review.save();
    summary.errors++;
    logger.error('Gemini analysis failed', {
      reviewId,
      error: analysisError.message,
    });
  }
}

/**
 * Post a reply to a review on the source platform and update the database.
 *
 * Only posts if:
 *   - replyPosted is false
 *   - requiresEscalation is false (unless manual override)
 *   - generatedReply is not empty
 *
 * @param {import('mongoose').Document} review — Review document from MongoDB.
 * @param {Object}  [options]
 * @param {boolean} [options.force=false] — Force post even if escalation required.
 * @param {string}  [options.customReply] — Override the generated reply.
 * @param {string}  [options.postedBy='system'] — Who initiated the reply.
 * @returns {Promise<Object>} — Reply record.
 */
async function postReplyToReview(review, options = {}) {
  const {
    force = false,
    customReply,
    postedBy = 'system',
  } = options;

  // Guard: already replied
  if (review.replyPosted) {
    logger.warn('Reply already posted for this review', { reviewId: review.reviewId });
    return null;
  }

  // Guard: escalation reviews need manual approval (unless forced)
  if (review.requiresEscalation && !force) {
    logger.info('Skipping auto-reply for escalation review', { reviewId: review.reviewId });
    return null;
  }

  const replyText = customReply || review.generatedReply;

  if (!replyText || replyText.trim().length === 0) {
    logger.warn('No reply text available', { reviewId: review.reviewId });
    return null;
  }

  // Create a reply record for audit tracking
  const replyRecord = await ReviewReply.create({
    reviewId: review.reviewId,
    review: review._id,
    replyText,
    replySource: customReply ? 'manual' : 'auto',
    status: 'pending',
    postedBy,
  });

  try {
    // Post via the appropriate adapter based on the review source
    const adapter = adapters[review.source];
    if (adapter) {
      await adapter.postReply(review.reviewId, replyText);
    } else {
      logger.warn(`No adapter available for source: ${review.source}`);
      throw new Error(`Unsupported review source: ${review.source}`);
    }

    // Update reply record
    replyRecord.status = 'posted';
    replyRecord.postedAt = new Date();
    replyRecord.attempts += 1;
    await replyRecord.save();

    // Update the review document
    review.replyPosted = true;
    review.replyPostedAt = new Date();
    await review.save();

    logger.info('Reply posted successfully', {
      reviewId: review.reviewId,
      replySource: replyRecord.replySource,
      postedBy,
    });

    return replyRecord;
  } catch (error) {
    // Update reply record with failure
    replyRecord.status = 'failed';
    replyRecord.error = error.message;
    replyRecord.attempts += 1;
    await replyRecord.save();

    logger.error('Failed to post reply', {
      reviewId: review.reviewId,
      error: error.message,
      attempts: replyRecord.attempts,
    });

    throw error;
  }
}

/**
 * Manually post a reply to a review (admin action).
 *
 * @param {string} reviewMongoId — MongoDB _id of the review.
 * @param {string} replyText     — Reply text to post.
 * @param {string} [adminEmail]  — Email of the admin posting the reply.
 * @returns {Promise<Object>}    — Reply record.
 */
async function manualReply(reviewMongoId, replyText, adminEmail = 'admin') {
  const review = await Review.findById(reviewMongoId);
  if (!review) {
    throw new Error(`Review not found: ${reviewMongoId}`);
  }

  logger.info('Manual reply initiated', {
    reviewId: review.reviewId,
    postedBy: adminEmail,
  });

  return postReplyToReview(review, {
    force: true,
    customReply: replyText,
    postedBy: adminEmail,
  });
}

/**
 * Reprocess a single review: re-run Gemini analysis and update results.
 *
 * @param {string} reviewMongoId — MongoDB _id of the review to reprocess.
 * @returns {Promise<Object>}    — Updated review document.
 */
async function reprocessReview(reviewMongoId) {
  const review = await Review.findById(reviewMongoId);
  if (!review) {
    throw new Error(`Review not found: ${reviewMongoId}`);
  }

  logger.info('Reprocessing review', { reviewId: review.reviewId });

  review.analysisStatus = 'processing';
  await review.save();

  try {
    const analysis = await analyzeReview(review.comment);

    review.sentiment = analysis.sentiment;
    review.concern = analysis.concern;
    review.concernType = analysis.concernType;
    review.confidence = analysis.confidence;
    review.requiresEscalation = analysis.requiresEscalation;
    review.generatedReply = analysis.reply;
    review.analysisStatus = 'completed';
    review.processedAt = new Date();
    review.replyPosted = false; // Reset reply status for reprocessed reviews

    await review.save();
    logger.info('Review reprocessed successfully', {
      reviewId: review.reviewId,
      sentiment: analysis.sentiment,
    });

    return review;
  } catch (error) {
    review.analysisStatus = 'failed';
    review.analysisError = error.message;
    await review.save();
    throw error;
  }
}

module.exports = {
  processNewReviews,
  reprocessReview,
  postReplyToReview,
  manualReply,
};
