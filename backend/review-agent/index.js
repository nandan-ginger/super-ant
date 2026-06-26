'use strict';

const express = require('express');
const router = express.Router();

const dashboardRouter = require('./routes/dashboard');
const reviewsRouter = require('./routes/reviews');
const replyRouter = require('./routes/reply');
const { startReviewPolling, stopReviewPolling } = require('./jobs/reviewPolling');

// Mount sub-routes
router.use('/dashboard', dashboardRouter);
router.use('/reviews', reviewsRouter);
// reply routes are mounted under the '/reviews' namespace so that they match the URI prefix /reviews/:id/reply
router.use('/reviews', replyRouter);

module.exports = {
  router,
  startReviewPolling,
  stopReviewPolling,
};
