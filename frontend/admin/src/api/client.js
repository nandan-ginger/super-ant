/**
 * client.js — Backward-compatible barrel re-export.
 *
 * All existing imports like:
 *   import { auth, widgets, livechats } from '@/api/client'
 * continue to work unchanged.
 *
 * New product-specific code should import directly from:
 *   @/api/common/auth   — auth & user management
 *   @/api/chatbot       — chatbot product APIs
 *   @/api/core          — raw apiFetch + setUnauthorizedHandler
 */
export { apiFetch, setUnauthorizedHandler } from './core'
export { auth } from './common/auth'
export { dashboard, widgets, livechats, leads, visitors } from './chatbot/index'

