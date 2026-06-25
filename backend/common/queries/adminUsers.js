'use strict';
const bcrypt = require('bcryptjs');
const AdminUser = require('../models/AdminUser');

const SALT_ROUNDS = 12;

/**
 * Create the initial superadmin if none exists.
 * Called at server startup.
 * @param {object} params
 * @param {string} params.username
 * @param {string} params.email
 * @param {string} params.password  plain-text, will be hashed
 */
async function seedSuperAdmin({ username, email, password }) {
  // Only seed if no superadmin exists yet
  const existing = await AdminUser.findOne({ role: 'superadmin' }).lean();
  if (existing) return null;

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const fullPermissions = {
    widgets:   { view: true, edit: true, delete: true },
    livechats: { view: true },
    visitors:  { view: true },
    leads:     { view: true },
  };

  const admin = await AdminUser.create({
    username,
    email,
    passwordHash,
    role:        'superadmin',
    permissions: fullPermissions,
    isActive:    true,
    createdAt:   new Date(),
    updatedAt:   new Date(),
  });

  const row = admin.toJSON();
  return {
    id:         row.id,
    username:   row.username,
    email:      row.email,
    role:       row.role,
    permissions: row.permissions,
    created_at: row.created_at,
  };
}

/**
 * Find an admin user by username or email (for login).
 * Returns full document including password_hash for verification.
 * @param {string} usernameOrEmail
 */
async function findAdminByLogin(usernameOrEmail) {
  const admin = await AdminUser.findOne({
    $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
    isActive: true,
  }).lean();
  if (!admin) return null;
  return _toRow(admin, true); // include password_hash
}

/**
 * Find an admin user by ID.
 * @param {string} id
 */
async function findAdminById(id) {
  const admin = await AdminUser.findById(id).lean();
  return admin ? _toRow(admin, false) : null;
}

/**
 * Create a new admin user (only superadmin can call this).
 * @param {object} params
 * @param {string} params.username
 * @param {string} params.email
 * @param {string} params.password  plain-text
 * @param {object} [params.permissions]
 * @param {string} params.createdBy  superadmin's ObjectId string
 */
async function createAdminUser({ username, email, password, permissions = {}, createdBy }) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const defaultPermissions = {
    widgets:   { view: false, edit: false, delete: false },
    livechats: { view: false },
    visitors:  { view: false },
    leads:     { view: false },
    ...permissions,
  };

  const admin = await AdminUser.create({
    username,
    email,
    passwordHash,
    role:        'admin',
    permissions: defaultPermissions,
    isActive:    true,
    createdBy:   createdBy || null,
    createdAt:   new Date(),
    updatedAt:   new Date(),
  });
  return _toRow(admin.toObject ? admin.toObject() : admin, false);
}

/**
 * List all admin users (for superadmin management).
 */
async function listAdminUsers() {
  const admins = await AdminUser.find().sort({ createdAt: -1 }).lean();
  return admins.map(a => _toRow(a, false));
}

/**
 * Update an admin user's permissions.
 * @param {string} id  admin user's ObjectId string
 * @param {object} permissions
 */
async function updateAdminPermissions(id, permissions) {
  const admin = await AdminUser.findOneAndUpdate(
    { _id: id, role: 'admin' },
    { $set: { permissions, updatedAt: new Date() } },
    { returnDocument: 'after' }
  ).lean();
  return admin ? _toRow(admin, false) : null;
}

/**
 * Toggle active status of an admin (enable/disable access).
 * @param {string} id
 * @param {boolean} isActive
 */
async function setAdminActive(id, isActive) {
  const admin = await AdminUser.findOneAndUpdate(
    { _id: id, role: 'admin' },
    { $set: { isActive, updatedAt: new Date() } },
    { returnDocument: 'after' }
  ).lean();
  return admin ? _toRow(admin, false) : null;
}

/**
 * Verify a plain-text password against stored hash.
 * @param {string} plainText
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(plainText, hash) {
  return bcrypt.compare(plainText, hash);
}

/**
 * Map a lean Mongoose AdminUser document to the snake_case shape the
 * rest of the application expects.
 * @param {object} doc  lean document
 * @param {boolean} includeHash  whether to include password_hash
 */
function _toRow(doc, includeHash) {
  const row = {
    id:          doc._id.toString(),
    username:    doc.username,
    email:       doc.email,
    role:        doc.role,
    permissions: doc.permissions,
    is_active:   doc.isActive,
    created_by:  doc.createdBy ? doc.createdBy.toString() : null,
    created_at:  doc.createdAt,
    updated_at:  doc.updatedAt,
  };
  if (includeHash) {
    row.password_hash = doc.passwordHash;
  }
  return row;
}

module.exports = {
  seedSuperAdmin,
  findAdminByLogin,
  findAdminById,
  createAdminUser,
  listAdminUsers,
  updateAdminPermissions,
  setAdminActive,
  verifyPassword,
};
