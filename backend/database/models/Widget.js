'use strict';
const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Widget — one document per registered customer website.
 */
const widgetSchema = new mongoose.Schema(
  {
    widgetCode:  { type: String, required: true, unique: true, index: true },
    name:        { type: String, required: true },
    url:         { type: String, required: true },
    description: { type: String, default: null },
    createdAt:   { type: Date,   default: Date.now, index: -1 },
    updatedAt:   { type: Date,   default: Date.now },
  },
  {
    timestamps: false,
    toJSON: {
      virtuals: false,
      transform(doc, ret) {
        ret.id          = ret._id.toString();
        ret.widget_code = ret.widgetCode;
        ret.created_at  = ret.createdAt;
        ret.updated_at  = ret.updatedAt;
        delete ret._id;
        delete ret.__v;
        delete ret.widgetCode;
        delete ret.createdAt;
        delete ret.updatedAt;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('Widget', widgetSchema);
