'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../common/middleware/adminAuth');
const { findPaginatedReviews, findById } = require('../queries/reviews');
const logger = require('../../common/utils/logger');

/**
 * GET /api/review-agent/reviews
 * Fetch reviews with pagination and filters.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sentiment,
      replyPosted,
      requiresEscalation,
      source,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const result = await findPaginatedReviews({
      page,
      limit,
      sentiment,
      replyPosted,
      requiresEscalation,
      source,
      sortBy,
      sortOrder,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('GET /review-agent/reviews error', { error: error.message });
    return res.status(500).json({ error: 'Failed to retrieve reviews.' });
  }
});

/**
 * GET /api/review-agent/reviews/:id
 * Fetch a single review by its ID.
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const review = await findById(id);

    if (!review) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    return res.json({
      success: true,
      data: review,
    });
  } catch (error) {
    logger.error('GET /review-agent/reviews/:id error', { error: error.message });
    return res.status(500).json({ error: 'Failed to retrieve review.' });
  }
});

module.exports = router;
