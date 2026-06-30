import { apiFetch } from '../core'

/**
 * Page Rules API client for the admin panel.
 *
 * All endpoints require admin authentication (handled by apiFetch + AuthContext).
 */
export const pageRules = {
  /** List all page rules for a widget. */
  list: (widgetCode) =>
    apiFetch(`/api/page-rules?widgetCode=${encodeURIComponent(widgetCode)}`),

  /** Create a new page rule. */
  create: (data) =>
    apiFetch('/api/page-rules', { method: 'POST', body: JSON.stringify(data) }),

  /** Update an existing page rule by ID. */
  update: (id, data) =>
    apiFetch(`/api/page-rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  /** Delete a page rule by ID. */
  delete: (id) =>
    apiFetch(`/api/page-rules/${id}`, { method: 'DELETE' }),
}
