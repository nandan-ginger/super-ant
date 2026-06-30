'use strict';
const mongoose = require('mongoose');

/**
 * PageRule — one document per configured page within a widget.
 *
 * Stores per-page settings:
 *   - urlPath:           exact pathname to match (e.g. "/about", "/contact")
 *   - popupDelaySeconds: how many seconds after page load to auto-open the chat panel
 *                        null = never auto-open (user must click the button)
 *                        0    = open immediately on page load
 *   - welcomeMessage:    override the default bot greeting for this page
 *   - staticContext:     admin-written context text for the AI to use on this page
 *   - contextOnlyMode:   if true, skip page scraping and use ONLY staticContext
 */
const pageRuleSchema = new mongoose.Schema(
  {
    widgetCode:        { type: String, required: true, index: true },
    name:              { type: String, required: true },
    urlPath:           { type: String, required: true },
    popupDelaySeconds: { type: Number, default: null },
    welcomeMessage:    { type: String, default: '' },
    staticContext:     { type: String, default: '' },
    contextOnlyMode:   { type: Boolean, default: false },
    createdAt:         { type: Date, default: Date.now },
    updatedAt:         { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    toJSON: {
      virtuals: false,
      transform(doc, ret) {
        ret.id         = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index: one urlPath per widgetCode (enforce uniqueness per widget)
pageRuleSchema.index({ widgetCode: 1, urlPath: 1 }, { unique: true });

module.exports = mongoose.model('PageRule', pageRuleSchema);
