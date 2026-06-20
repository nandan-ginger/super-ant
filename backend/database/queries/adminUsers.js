'use strict';
const { query } = require('../connection');
const bcrypt = require('bcryptjs');

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
  const { rows } = await query(
    `SELECT id FROM admin_users WHERE role = 'superadmin' LIMIT 1`
  );
  if (rows.length > 0) return null; // already exists

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const sql = `
    INSERT INTO admin_users (username, email, password_hash, role, permissions)
    VALUES ($1, $2, $3, 'superadmin', $4)
    RETURNING id, username, email, role, permissions, created_at
  `;
  const fullPermissions = {
    widgets:   { view: true, edit: true, delete: true },
    livechats: { view: true },
    visitors:  { view: true },
    leads:     { view: true },
  };
  const { rows: inserted } = await query(sql, [
    username,
    email,
    password_hash,
    JSON.stringify(fullPermissions),
  ]);
  return inserted[0];
}

/**
 * Find an admin user by username or email (for login).
 * @param {string} usernameOrEmail
 */
async function findAdminByLogin(usernameOrEmail) {
  const { rows } = await query(
    `SELECT * FROM admin_users
     WHERE (username = $1 OR email = $1) AND is_active = TRUE
     LIMIT 1`,
    [usernameOrEmail]
  );
  return rows[0] || null;
}

/**
 * Find an admin user by ID.
 * @param {string} id
 */
async function findAdminById(id) {
  const { rows } = await query(
    `SELECT id, username, email, role, permissions, is_active, created_by, created_at, updated_at
     FROM admin_users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Create a new admin user (only superadmin can call this).
 * @param {object} params
 * @param {string} params.username
 * @param {string} params.email
 * @param {string} params.password  plain-text
 * @param {object} [params.permissions]
 * @param {string} params.createdBy  superadmin's UUID
 */
async function createAdminUser({ username, email, password, permissions = {}, createdBy }) {
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const defaultPermissions = {
    widgets:   { view: false, edit: false, delete: false },
    livechats: { view: false },
    visitors:  { view: false },
    leads:     { view: false },
    ...permissions,
  };
  const sql = `
    INSERT INTO admin_users (username, email, password_hash, role, permissions, created_by)
    VALUES ($1, $2, $3, 'admin', $4, $5)
    RETURNING id, username, email, role, permissions, is_active, created_at
  `;
  const { rows } = await query(sql, [
    username,
    email,
    password_hash,
    JSON.stringify(defaultPermissions),
    createdBy,
  ]);
  return rows[0];
}

/**
 * List all admin users (for superadmin management).
 */
async function listAdminUsers() {
  const { rows } = await query(
    `SELECT id, username, email, role, permissions, is_active, created_by, created_at, updated_at
     FROM admin_users
     ORDER BY created_at DESC`
  );
  return rows;
}

/**
 * Update an admin user's permissions.
 * @param {string} id  admin user's UUID
 * @param {object} permissions
 */
async function updateAdminPermissions(id, permissions) {
  const { rows } = await query(
    `UPDATE admin_users
     SET permissions = $2, updated_at = NOW()
     WHERE id = $1 AND role = 'admin'
     RETURNING id, username, email, role, permissions, updated_at`,
    [id, JSON.stringify(permissions)]
  );
  return rows[0] || null;
}

/**
 * Toggle active status of an admin (enable/disable access).
 * @param {string} id
 * @param {boolean} isActive
 */
async function setAdminActive(id, isActive) {
  const { rows } = await query(
    `UPDATE admin_users SET is_active = $2, updated_at = NOW()
     WHERE id = $1 AND role = 'admin'
     RETURNING id, username, email, role, is_active`,
    [id, isActive]
  );
  return rows[0] || null;
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
