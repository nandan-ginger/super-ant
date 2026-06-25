'use strict';
const mongoose = require('mongoose');

/**
 * Session — one document per widget browser session.
 * _id is the string UUID/socket ID passed by the client.
 */
const sessionSchema = new mongoose.Schema(
  {
    _id:        { type: String, required: true },   // UUID from backend / socket.id
    widgetCode: { type: String, required: true, index: true },
    pageUrl:    { type: String, default: null },
    pageTitle:  { type: String, default: null },
    startedAt:  { type: Date,   default: Date.now, index: -1 },
    lastActive: { type: Date,   default: Date.now },
  },
  {
    // Do NOT let Mongoose manage _id (we provide it ourselves)
    _id: false,
    // Disable automatic createdAt/updatedAt — we manage our own timestamps
    timestamps: false,
    // Produce plain objects that look like the old PostgreSQL rows
    toJSON: {
      virtuals: false,
      transform(doc, ret) {
        ret.id          = ret._id;
        ret.widget_code = ret.widgetCode;
        ret.page_url    = ret.pageUrl;
        ret.page_title  = ret.pageTitle;
        ret.started_at  = ret.startedAt;
        ret.last_active = ret.lastActive;
        delete ret._id;
        delete ret.__v;
        delete ret.widgetCode;
        delete ret.pageUrl;
        delete ret.pageTitle;
        delete ret.startedAt;
        delete ret.lastActive;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('Session', sessionSchema);
