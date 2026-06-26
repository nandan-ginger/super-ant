'use strict';

const { google } = require('googleapis');
const BaseAdapter = require('./BaseAdapter');
const { createOAuth2Client } = require('../config/google');
const { retry } = require('../utils/retry');
const config = require('../../common/config');
const logger = require('../../common/utils/logger');

// ---------------------------------------------------------------------------
// GoogleReviewAdapter — Fetches reviews from Google Business Profile API
// ---------------------------------------------------------------------------

/**
 * Mapping from Google's star rating enum to numeric values.
 */
const STAR_RATING_MAP = {
  STAR_RATING_UNSPECIFIED: 0,
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

class GoogleReviewAdapter extends BaseAdapter {
  constructor() {
    super('google');
    this.authClient = null;
    this.accountId = config.reviewAgent.google.accountId;
    this.locationId = config.reviewAgent.google.locationId;
  }

  /**
   * Initialize the OAuth2 client (lazy).
   * @private
   */
  _ensureAuth() {
    if (!this.authClient) {
      this.authClient = createOAuth2Client();
    }
    return this.authClient;
  }

  /**
   * Fetch reviews from Google Business Profile API.
   *
   * Uses the Google My Business API v4 endpoint:
   *   GET /v4/{parent=accounts/x/locations/x}/reviews
   *
   * @param {Object}  [options]
   * @param {number}  [options.pageSize=50]  — Number of reviews per page.
   * @param {string}  [options.pageToken]     — Token for next page.
   * @returns {Promise<import('./BaseAdapter').NormalizedReview[]>}
   */
  async fetchReviews(options = {}) {
    const { pageSize = 50, pageToken } = options;
    const auth = this._ensureAuth();

    const parent = `${this.accountId}/${this.locationId}`;
    const url = `https://mybusiness.googleapis.com/v4/${parent}/reviews`;

    const params = { pageSize };
    if (pageToken) params.pageToken = pageToken;

    logger.info('Fetching Google reviews', { parent, pageSize });

    const response = await retry(
      async () => {
        const res = await auth.request({
          url,
          method: 'GET',
          params,
        });
        return res;
      },
      {
        retries: 3,
        baseDelayMs: 2000,
        label: 'Google Reviews API — fetch',
        shouldRetry: (err) => {
          // Retry on 429 (rate limit) and 5xx errors
          const status = err?.response?.status || err?.code;
          return status === 429 || (status >= 500 && status < 600);
        },
      }
    );

    const reviews = response.data?.reviews || [];
    logger.info(`Fetched ${reviews.length} Google reviews`, { parent });

    return reviews.map((review) => this._normalize(review));
  }

  /**
   * Post a reply to a Google review.
   *
   * Uses the Google My Business API v4 endpoint:
   *   PUT /v4/{parent=accounts/x/locations/x/reviews/x}/reply
   *
   * @param {string} reviewId  — Google review name (full resource path).
   * @param {string} replyText — Reply text.
   * @returns {Promise<boolean>}
   */
  async postReply(reviewId, replyText) {
    const auth = this._ensureAuth();

    // reviewId is the full resource name, e.g., accounts/xxx/locations/xxx/reviews/xxx
    const url = `https://mybusiness.googleapis.com/v4/${reviewId}/reply`;

    logger.info('Posting reply to Google review', { reviewId });

    await retry(
      async () => {
        await auth.request({
          url,
          method: 'PUT',
          data: {
            comment: replyText,
          },
        });
      },
      {
        retries: 3,
        baseDelayMs: 2000,
        label: 'Google Reviews API — reply',
        shouldRetry: (err) => {
          const status = err?.response?.status || err?.code;
          return status === 429 || (status >= 500 && status < 600);
        },
      }
    );

    logger.info('Reply posted successfully', { reviewId });
    return true;
  }

  /**
   * Normalize a Google review object into the standard format.
   * @private
   * @param {Object} review — Raw Google review object.
   * @returns {import('./BaseAdapter').NormalizedReview}
   */
  _normalize(review) {
    return {
      reviewId: review.name || review.reviewId,
      authorName: review.reviewer?.displayName || 'Anonymous',
      rating: STAR_RATING_MAP[review.starRating] || 0,
      comment: review.comment || '',
      createdAt: review.createTime ? new Date(review.createTime) : new Date(),
      profilePhotoUrl: review.reviewer?.profilePhotoUrl || '',
    };
  }
}

module.exports = GoogleReviewAdapter;
