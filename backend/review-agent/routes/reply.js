'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../common/middleware/adminAuth');
const { manualReply, reprocessReview } = require('../services/replyOrchestrator');
const logger = require('../../common/utils/logger');

/**
 * POST /api/review-agent/reviews/:id/reply
 * Manually post a reply to a review (admin action).
 */
router.post('/:id/reply', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { replyText } = req.body;
    const adminEmail = req.admin?.email || 'admin';

    if (!replyText || replyText.trim().length === 0) {
      return res.status(400).json({ error: 'replyText is required.' });
    }

    const replyRecord = await manualReply(id, replyText, adminEmail);

    return res.json({
      success: true,
      message: 'Reply posted successfully',
      data: replyRecord,
    });
  } catch (error) {
    logger.error('POST /review-agent/reviews/:id/reply error', { error: error.message });
    return res.status(500).json({ error: error.message || 'Failed to post reply.' });
  }
});

/**
 * POST /api/review-agent/reviews/:id/reprocess
 * Re-run Gemini analysis on a review.
 */
router.post('/:id/reprocess', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const updatedReview = await reprocessReview(id);

    return res.json({
      success: true,
      message: 'Review reprocessed successfully',
      data: updatedReview,
    });
  } catch (error) {
    logger.error('POST /review-agent/reviews/:id/reprocess error', { error: error.message });
    return res.status(500).json({ error: error.message || 'Failed to reprocess review.' });
  }
});

module.exports = router;
