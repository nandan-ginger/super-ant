'use strict';

const BaseAdapter = require('./BaseAdapter');
const logger = require('../../common/utils/logger');

// ---------------------------------------------------------------------------
// ReviewTreasuresAdapter — Stub adapter for ReviewTreasures integration
// ---------------------------------------------------------------------------
// This is a placeholder for future integration with the ReviewTreasures
// platform.  Implement fetchReviews() and postReply() when the API
// specification becomes available.
// ---------------------------------------------------------------------------

class ReviewTreasuresAdapter extends BaseAdapter {
  constructor() {
    super('reviewtreasures');
  }

  async fetchReviews(/* options */) {
    logger.warn('ReviewTreasuresAdapter.fetchReviews() is not yet implemented');
    return [];
  }

  async postReply(/* reviewId, replyText */) {
    logger.warn('ReviewTreasuresAdapter.postReply() is not yet implemented');
    return false;
  }
}

module.exports = ReviewTreasuresAdapter;
