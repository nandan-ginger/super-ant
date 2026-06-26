'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Review Model — Stores Google Reviews with AI analysis results
// ---------------------------------------------------------------------------

const reviewSchema = new mongoose.Schema(
  {
    // ---- Source identifiers ----
    reviewId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      comment: 'Unique ID from the review source (e.g., Google review name)',
    },
    locationId: {
      type: String,
      required: true,
      trim: true,
      comment: 'Google Business Profile location identifier',
    },
    source: {
      type: String,
      enum: ['google', 'reviewtreasures', 'facebook', 'trustpilot', 'yelp'],
      default: 'google',
      index: true,
      comment: 'Review source platform for multi-platform support',
    },

    // ---- Review content ----
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
    profilePhotoUrl: {
      type: String,
      trim: true,
    },
    starRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      default: '',
      comment: 'Review text — may be empty for rating-only reviews',
    },
    reviewCreatedAt: {
      type: Date,
      comment: 'Original review creation time from the platform',
    },

    // ---- AI analysis results ----
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative', 'critical', 'pending'],
      default: 'pending',
      index: true,
    },
    concern: {
      type: Boolean,
      default: false,
    },
    concernType: {
      type: String,
      enum: [
        'service',
        'staff',
        'pricing',
        'communication',
        'quality',
        'billing',
        'delivery',
        'technical',
        'general',
        'none',
      ],
      default: 'none',
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
      comment: 'AI confidence score for the sentiment classification',
    },

    // ---- Reply management ----
    generatedReply: {
      type: String,
      default: '',
      comment: 'AI-generated reply text',
    },
    replyPosted: {
      type: Boolean,
      default: false,
      index: true,
    },
    replyPostedAt: {
      type: Date,
    },

    // ---- Escalation ----
    requiresEscalation: {
      type: Boolean,
      default: false,
      index: true,
    },
    escalationNotified: {
      type: Boolean,
      default: false,
      comment: 'Whether the escalation email has been sent',
    },

    // ---- Processing status ----
    analysisStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    analysisError: {
      type: String,
      comment: 'Error message if AI analysis failed',
    },
    processedAt: {
      type: Date,
      comment: 'Timestamp when AI analysis was completed',
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ---------------------------------------------------------------------------
// Indexes — Compound indexes for common query patterns
// ---------------------------------------------------------------------------

// Dashboard queries: filter by sentiment + date
reviewSchema.index({ sentiment: 1, createdAt: -1 });

// Polling: find unprocessed reviews
reviewSchema.index({ analysisStatus: 1, createdAt: -1 });

// Reply queue: find reviews needing reply posting
reviewSchema.index({ replyPosted: 1, requiresEscalation: 1 });

// Escalation queue: find reviews needing escalation notification
reviewSchema.index({ requiresEscalation: 1, escalationNotified: 1 });

// Date range queries
reviewSchema.index({ createdAt: -1 });

// ---------------------------------------------------------------------------
// Static methods
// ---------------------------------------------------------------------------

/**
 * Check if a review with the given reviewId already exists.
 * @param {string} reviewId
 * @returns {Promise<boolean>}
 */
reviewSchema.statics.existsReview = async function (reviewId) {
  const count = await this.countDocuments({ reviewId }).limit(1);
  return count > 0;
};

/**
 * Get review statistics grouped by sentiment.
 * @returns {Promise<Object>}
 */
reviewSchema.statics.getStats = async function () {
  const pipeline = [
    {
      $facet: {
        total: [{ $count: 'count' }],
        bySentiment: [
          {
            $group: {
              _id: '$sentiment',
              count: { $sum: 1 },
            },
          },
        ],
        avgRating: [
          {
            $group: {
              _id: null,
              average: { $avg: '$starRating' },
            },
          },
        ],
        pendingReplies: [
          {
            $match: {
              replyPosted: false,
              requiresEscalation: false,
              analysisStatus: 'completed',
            },
          },
          { $count: 'count' },
        ],
        escalations: [
          { $match: { requiresEscalation: true } },
          { $count: 'count' },
        ],
      },
    },
  ];

  const [result] = await this.aggregate(pipeline);

  const sentimentMap = {};
  const bySentiment = result.bySentiment || [];
  for (const item of bySentiment) {
    if (item._id) {
      sentimentMap[item._id] = item.count;
    }
  }

  return {
    totalReviews: result.total[0]?.count || 0,
    positive: sentimentMap.positive || 0,
    neutral: sentimentMap.neutral || 0,
    negative: sentimentMap.negative || 0,
    critical: sentimentMap.critical || 0,
    pending: sentimentMap.pending || 0,
    averageRating: parseFloat((result.avgRating[0]?.average || 0).toFixed(2)),
    pendingReplies: result.pendingReplies[0]?.count || 0,
    escalations: result.escalations[0]?.count || 0,
  };
};

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
