'use strict';
const mongoose = require('mongoose');

/**
 * Lead — contact details captured from a visitor session.
 * widgetCode is denormalized here (copied from session) so we never
 * need a $lookup/join to filter leads by website.
 */
const leadSchema = new mongoose.Schema(
  {
    sessionId:   { type: String, default: null, index: true },
    widgetCode:  { type: String, default: null, index: true },  // denormalized
    name:        { type: String, default: null },
    email:       { type: String, default: null, index: true },
    phone:       { type: String, default: null },
    requirement: { type: String, default: null },
    intent:      { type: String, default: null, index: true },
    pageUrl:     { type: String, default: null },
    capturedAt:  { type: Date,   default: Date.now, index: -1 },
  },
  {
    timestamps: false,
    toJSON: {
      virtuals: false,
      transform(doc, ret) {
        ret.id          = ret._id.toString();
        ret.session_id  = ret.sessionId;
        ret.widget_code = ret.widgetCode;
        ret.page_url    = ret.pageUrl;
        ret.captured_at = ret.capturedAt;
        delete ret._id;
        delete ret.__v;
        delete ret.sessionId;
        delete ret.widgetCode;
        delete ret.pageUrl;
        delete ret.capturedAt;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('Lead', leadSchema);
