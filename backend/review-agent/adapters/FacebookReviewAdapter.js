'use strict';

const BaseAdapter = require('./BaseAdapter');
const logger = require('../../common/utils/logger');

// ---------------------------------------------------------------------------
// FacebookReviewAdapter — Stub adapter for Facebook Reviews integration
// ---------------------------------------------------------------------------

class FacebookReviewAdapter extends BaseAdapter {
  constructor() {
    super('facebook');
  }

  async fetchReviews(/* options */) {
    logger.warn('FacebookReviewAdapter.fetchReviews() is not yet implemented');
    return [];
  }

  async postReply(/* reviewId, replyText */) {
    logger.warn('FacebookReviewAdapter.postReply() is not yet implemented');
    return false;
  }
}

module.exports = FacebookReviewAdapter;
