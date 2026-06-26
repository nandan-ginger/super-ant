'use strict';

const BaseAdapter = require('./BaseAdapter');
const logger = require('../../common/utils/logger');

// ---------------------------------------------------------------------------
// TrustPilotAdapter — Stub adapter for TrustPilot Reviews integration
// ---------------------------------------------------------------------------

class TrustPilotAdapter extends BaseAdapter {
  constructor() {
    super('trustpilot');
  }

  async fetchReviews(/* options */) {
    logger.warn('TrustPilotAdapter.fetchReviews() is not yet implemented');
    return [];
  }

  async postReply(/* reviewId, replyText */) {
    logger.warn('TrustPilotAdapter.postReply() is not yet implemented');
    return false;
  }
}

module.exports = TrustPilotAdapter;
