'use strict';

// ---------------------------------------------------------------------------
// BaseAdapter — Abstract adapter interface for review sources
// ---------------------------------------------------------------------------
// All review source adapters must extend this class and implement the
// `fetchReviews` method.  This ensures a consistent normalized format
// regardless of the source platform.
// ---------------------------------------------------------------------------

/**
 * Normalized review object returned by all adapters.
 * @typedef {Object} NormalizedReview
 * @property {string}  reviewId    — Unique identifier from the source platform.
 * @property {string}  authorName  — Name of the review author.
 * @property {number}  rating      — Star rating (1–5).
 * @property {string}  comment     — Review text (may be empty).
 * @property {Date}    createdAt   — Original review creation date.
 * @property {string}  [profilePhotoUrl] — Author's profile photo URL.
 */

class BaseAdapter {
  /**
   * @param {string} source — Source identifier (e.g., 'google', 'facebook').
   */
  constructor(source) {
    if (new.target === BaseAdapter) {
      throw new Error('BaseAdapter is abstract and cannot be instantiated directly');
    }
    this.source = source;
  }

  /**
   * Fetch reviews from the source platform.
   *
   * @param {Object} [options] — Platform-specific options (pagination, filters).
   * @returns {Promise<NormalizedReview[]>} — Array of normalized review objects.
   */
  async fetchReviews(/* options */) {
    throw new Error(`fetchReviews() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Post a reply to a review on the source platform.
   *
   * @param {string} reviewId  — Review identifier on the source platform.
   * @param {string} replyText — Reply text to post.
   * @returns {Promise<boolean>} — True if reply was posted successfully.
   */
  async postReply(/* reviewId, replyText */) {
    throw new Error(`postReply() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Get the source identifier.
   * @returns {string}
   */
  getSource() {
    return this.source;
  }
}

module.exports = BaseAdapter;
