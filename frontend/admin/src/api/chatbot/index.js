import { apiFetch } from '../core'

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboard = {
  stats: () => apiFetch('/api/dashboard/stats'),
}

// ── Widgets ───────────────────────────────────────────────────────────────────
export const widgets = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return apiFetch(`/api/widgets${qs ? '?' + qs : ''}`)
  },
  create: (data) =>
    apiFetch('/api/widgets', { method: 'POST', body: JSON.stringify(data) }),
  update: (code, data) =>
    apiFetch(`/api/widgets/${code}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (code) =>
    apiFetch(`/api/widgets/${code}`, { method: 'DELETE' }),
  get: (code) =>
    apiFetch(`/api/widgets/${code}`),
}

// ── Live Chats ────────────────────────────────────────────────────────────────
export const livechats = {
  sessions: (widgetCode, params = {}) => {
    const qs = new URLSearchParams({ widgetCode, ...params }).toString()
    return apiFetch(`/api/livechats?${qs}`)
  },
  messages: (sessionId, params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return apiFetch(`/api/livechats/${sessionId}/messages${qs ? '?' + qs : ''}`)
  },
}

// ── Leads ─────────────────────────────────────────────────────────────────────
export const leads = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return apiFetch(`/api/leads${qs ? '?' + qs : ''}`)
  },
  get: (id) => apiFetch(`/api/leads/${id}`),
}

// ── Visitors ──────────────────────────────────────────────────────────────────
export const visitors = {
  list: (widgetCode, params = {}) => {
    const qs = new URLSearchParams({ widgetCode, ...params }).toString()
    return apiFetch(`/api/visitors?${qs}`)
  },
  get: (sessionId) => apiFetch(`/api/visitors/${sessionId}`),
}
