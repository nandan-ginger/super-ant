'use strict';

const Review = require('../models/Review');

/**
 * Get paginated list of reviews matching given filters.
 */
async function findPaginatedReviews({
  page = 1,
  limit = 20,
  sentiment,
  replyPosted,
  requiresEscalation,
  source,
  sortBy = 'createdAt',
  sortOrder = 'desc',
}) {
  const filter = {};
  if (sentiment) filter.sentiment = sentiment;
  
  if (replyPosted !== undefined) {
    filter.replyPosted = replyPosted === 'true' || replyPosted === true;
  }
  if (requiresEscalation !== undefined) {
    filter.requiresEscalation = requiresEscalation === 'true' || requiresEscalation === true;
  }
  if (source) filter.source = source;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  const [reviews, totalCount] = await Promise.all([
    Review.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Review.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalCount / limitNum);

  return {
    reviews,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalCount,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
    },
  };
}

/**
 * Get review statistics aggregated from database.
 */
async function getStats() {
  return await Review.getStats();
}

/**
 * Find a review by its MongoDB ObjectId.
 */
async function findById(id) {
  return await Review.findById(id).lean();
}

module.exports = {
  findPaginatedReviews,
  getStats,
  findById,
};
