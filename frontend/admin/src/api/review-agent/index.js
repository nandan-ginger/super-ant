import { apiFetch } from '../core';

/**
 * Fetch review statistics for the dashboard.
 */
export const getDashboardStats = () => apiFetch('/api/review-agent/dashboard/stats');

/**
 * Fetch reviews with pagination, filter, and sorting options.
 */
export const getReviews = (params = {}) => {
  const cleanParams = {};
  // Filter out undefined, null or empty strings
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      cleanParams[key] = params[key];
    }
  });
  const qs = new URLSearchParams(cleanParams).toString();
  return apiFetch(`/api/review-agent/reviews${qs ? '?' + qs : ''}`);
};

/**
 * Manually post a reply to a review.
 */
export const postReply = (id, replyText) => {
  return apiFetch(`/api/review-agent/reviews/${id}/reply`, {
    method: 'POST',
    body: JSON.stringify({ replyText }),
  });
};

/**
 * Re-run Gemini analysis for a review.
 */
export const reprocessReview = (id) => {
  return apiFetch(`/api/review-agent/reviews/${id}/reprocess`, {
    method: 'POST',
  });
};
