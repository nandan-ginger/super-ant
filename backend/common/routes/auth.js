'use strict';
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');
const {
  findAdminByLogin,
  findAdminById,
  createAdminUser,
  listAdminUsers,
  updateAdminPermissions,
  setAdminActive,
  verifyPassword,
} = require('../queries/adminUsers');
const { requireAuth, requireSuperAdmin } = require('../middleware/adminAuth');

const TOKEN_EXPIRY = '7d';

/**
 * POST /api/auth/login
 *
 * Body: { username, password }
 * Returns: { token, admin: { id, username, email, role, permissions } }
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required.' });
  }

  try {
    const admin = await findAdminByLogin(username);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const valid = await verifyPassword(password, admin.password_hash);
    if (!valid) {
      logger.warn('Admin auth: failed login attempt', { username, ip: req.ip });
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: admin.id, role: admin.role },
      config.jwtSecret,
      { expiresIn: TOKEN_EXPIRY }
    );

    logger.info('Admin logged in', { username: admin.username, role: admin.role });

    return res.json({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
      },
    });
  } catch (err) {
    logger.error('POST /api/auth/login error', { error: err.message });
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

/**
 * GET /api/auth/me
 *
 * Returns the current authenticated admin's profile.
 */
router.get('/me', requireAuth, (req, res) => {
  const { id, username, email, role, permissions } = req.admin;
  return res.json({ id, username, email, role, permissions });
});

/**
 * POST /api/auth/users
 * SuperAdmin only — create a new admin user.
 *
 * Body: { username, email, password, permissions? }
 */
router.post('/users', requireAuth, requireSuperAdmin, async (req, res) => {
  const { username, email, password, permissions } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, and password are required.' });
  }

  if (email){
    
  }

  try {
    const admin = await createAdminUser({
      username,
      email,
      password,
      permissions: permissions || {},
      createdBy: req.admin.id,
    });
    logger.info('New admin created', { by: req.admin.username, newAdmin: username });
    return res.status(201).json({ admin });
  } catch (err) {
    if (err.message.includes('unique') || err.message.includes('duplicate')) {
      return res.status(409).json({ error: 'Username or email already exists.' });
    }
    logger.error('POST /api/auth/users error', { error: err.message });
    return res.status(500).json({ error: 'Failed to create admin user.' });
  }
});

/**
 * GET /api/auth/users
 * SuperAdmin only — list all admin users.
 */
router.get('/users', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const users = await listAdminUsers();
    return res.json({ users });
  } catch (err) {
    logger.error('GET /api/auth/users error', { error: err.message });
    return res.status(500).json({ error: 'Failed to retrieve users.' });
  }
});

/**
 * PUT /api/auth/users/:id/permissions
 * SuperAdmin only — update an admin's permissions.
 *
 * Body: { permissions: { widgets: {view, edit, delete}, livechats: {view}, visitors: {view}, leads: {view} } }
 */
router.put('/users/:id/permissions', requireAuth, requireSuperAdmin, async (req, res) => {
  const { permissions } = req.body;

  if (!permissions || typeof permissions !== 'object') {
    return res.status(400).json({ error: 'permissions object is required.' });
  }

  try {
    const updated = await updateAdminPermissions(req.params.id, permissions);
    if (!updated) {
      return res.status(404).json({ error: 'Admin user not found or cannot update superadmin.' });
    }
    logger.info('Admin permissions updated', { by: req.admin.username, targetId: req.params.id });
    return res.json({ admin: updated });
  } catch (err) {
    logger.error('PUT /api/auth/users/:id/permissions error', { error: err.message });
    return res.status(500).json({ error: 'Failed to update permissions.' });
  }
});

/**
 * PUT /api/auth/users/:id/status
 * SuperAdmin only — enable or disable an admin account.
 *
 * Body: { is_active: boolean }
 */
router.put('/users/:id/status', requireAuth, requireSuperAdmin, async (req, res) => {
  const { is_active } = req.body;

  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'is_active (boolean) is required.' });
  }

  try {
    const updated = await setAdminActive(req.params.id, is_active);
    if (!updated) {
      return res.status(404).json({ error: 'Admin user not found or cannot modify superadmin.' });
    }
    logger.info('Admin status updated', { by: req.admin.username, targetId: req.params.id, is_active });
    return res.json({ admin: updated });
  } catch (err) {
    logger.error('PUT /api/auth/users/:id/status error', { error: err.message });
    return res.status(500).json({ error: 'Failed to update admin status.' });
  }
});

module.exports = router;
