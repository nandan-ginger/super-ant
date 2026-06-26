'use strict';

const BaseAdapter = require('./BaseAdapter');
const logger = require('../../common/utils/logger');

// ---------------------------------------------------------------------------
// YelpAdapter — Stub adapter for Yelp Reviews integration
// ---------------------------------------------------------------------------

class YelpAdapter extends BaseAdapter {
  constructor() {
    super('yelp');
  }

  async fetchReviews(/* options */) {
    logger.warn('YelpAdapter.fetchReviews() is not yet implemented');
    return [];
  }

  async postReply(/* reviewId, replyText */) {
    logger.warn('YelpAdapter.postReply() is not yet implemented');
    return false;
  }
}

module.exports = YelpAdapter;
