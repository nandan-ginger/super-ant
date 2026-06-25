'use strict';
const jwt = require('jsonwebtoken');
const config = require('../config');
const { findAdminById } = require('../queries/adminUsers');
const logger = require('../utils/logger');

/**
 * Verify JWT and attach admin user to req.admin.
 * Rejects with 401 if token is missing or invalid.
 */
async function requireAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Provide a Bearer token.' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const admin = await findAdminById(payload.id);

    if (!admin || !admin.is_active) {
      return res.status(401).json({ error: 'Account not found or disabled.' });
    }

    req.admin = admin;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    logger.warn('Admin auth: invalid token', { error: err.message, ip: req.ip });
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

/**
 * Require superadmin role.
 * Must come after requireAuth.
 */
function requireSuperAdmin(req, res, next) {
  if (req.admin?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin access required.' });
  }
  next();
}

/**
 * Require a specific permission.
 * Usage: requirePermission('leads', 'view')
 * SuperAdmins always pass.
 * Must come after requireAuth.
 *
 * @param {string} section   e.g. 'widgets', 'livechats', 'visitors', 'leads'
 * @param {string} action    e.g. 'view', 'edit', 'delete'
 */
function requirePermission(section, action) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    // SuperAdmin has all permissions
    if (req.admin.role === 'superadmin') {
      return next();
    }
    const perm = req.admin.permissions?.[section]?.[action];
    if (!perm) {
      return res.status(403).json({
        error: `You do not have permission to ${action} ${section}.`,
      });
    }
    next();
  };
}

module.exports = { requireAuth, requireSuperAdmin, requirePermission };
