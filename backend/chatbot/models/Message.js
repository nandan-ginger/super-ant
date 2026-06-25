'use strict';
const mongoose = require('mongoose');

/**
 * Message — one document per chat message within a session.
 */
const messageSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    role:      { type: String, required: true, enum: ['user', 'assistant', 'system'] },
    content:   { type: String, required: true },
    createdAt: { type: Date,   default: Date.now },
  },
  {
    timestamps: false,
    toJSON: {
      virtuals: false,
      transform(doc, ret) {
        ret.id         = ret._id.toString();
        ret.session_id = ret.sessionId;
        ret.created_at = ret.createdAt;
        delete ret._id;
        delete ret.__v;
        delete ret.sessionId;
        delete ret.createdAt;
        return ret;
      },
    },
  }
);

// Compound index for fetching messages per session in order
messageSchema.index({ sessionId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
