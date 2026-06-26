'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../common/middleware/adminAuth');
const { getStats } = require('../queries/reviews');
const logger = require('../../common/utils/logger');

async function getStatsHandler(req, res) {
  try {
    const stats = await getStats();
    return res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('GET /review-agent/dashboard/stats error', { error: error.message });
    return res.status(500).json({ error: 'Failed to retrieve review stats.' });
  }
}

router.get('/', requireAuth, getStatsHandler);
router.get('/stats', requireAuth, getStatsHandler);

module.exports = router;
