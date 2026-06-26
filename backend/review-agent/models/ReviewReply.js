'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// ReviewReply Model — Tracks reply history for auditing and retry
// ---------------------------------------------------------------------------

const reviewReplySchema = new mongoose.Schema(
  {
    reviewId: {
      type: String,
      required: true,
      index: true,
      comment: 'References the reviewId in the Review model',
    },
    review: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review',
      required: true,
    },

    // ---- Reply content ----
    replyText: {
      type: String,
      required: true,
      comment: 'The reply text that was sent (or attempted)',
    },
    replySource: {
      type: String,
      enum: ['auto', 'manual'],
      default: 'auto',
      comment: 'Whether the reply was auto-generated or manually posted by admin',
    },

    // ---- Posting status ----
    status: {
      type: String,
      enum: ['pending', 'posted', 'failed'],
      default: 'pending',
      index: true,
    },
    postedAt: {
      type: Date,
    },
    error: {
      type: String,
      comment: 'Error message if posting failed',
    },
    attempts: {
      type: Number,
      default: 0,
    },

    // ---- Audit ----
    postedBy: {
      type: String,
      default: 'system',
      comment: 'Identifier of who triggered the reply (system or admin email)',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index for finding pending replies
reviewReplySchema.index({ status: 1, createdAt: -1 });

const ReviewReply = mongoose.model('ReviewReply', reviewReplySchema);

module.exports = ReviewReply;
