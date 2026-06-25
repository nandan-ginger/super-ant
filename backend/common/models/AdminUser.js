'use strict';
const mongoose = require('mongoose');

/**
 * AdminUser — platform admins created by superadmin.
 */
const adminUserSchema = new mongoose.Schema(
  {
    username:     { type: String, required: true, unique: true, index: true },
    email:        { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role:         { type: String, required: true, enum: ['superadmin', 'admin'], default: 'admin', index: true },
    permissions:  {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isActive:     { type: Boolean, default: true },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
    createdAt:    { type: Date, default: Date.now },
    updatedAt:    { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    toJSON: {
      virtuals: false,
      transform(doc, ret) {
        ret.id           = ret._id.toString();
        ret.password_hash = ret.passwordHash;
        ret.is_active    = ret.isActive;
        ret.created_by   = ret.createdBy ? ret.createdBy.toString() : null;
        ret.created_at   = ret.createdAt;
        ret.updated_at   = ret.updatedAt;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.isActive;
        delete ret.createdBy;
        delete ret.createdAt;
        delete ret.updatedAt;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('AdminUser', adminUserSchema);
