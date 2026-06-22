// API base URL — uses Vite proxy in dev, same origin in prod
const API_BASE = import.meta.env.DEV ? '' : ''

let _onUnauthorized = null

export function setUnauthorizedHandler(fn) {
  _onUnauthorized = fn
}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('sa_token')
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (res.status === 401) {
    if (_onUnauthorized) _onUnauthorized()
    throw new Error('Session expired. Please log in again.')
  }

  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await res.json()
    : await res.text()

  if (!res.ok) {
    throw new Error((data?.error) || `HTTP ${res.status}`)
  }
  return data
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  login: (username, password) =>
    apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => apiFetch('/api/auth/me'),
  listUsers: () => apiFetch('/api/auth/users'),
  createUser: (data) =>
    apiFetch('/api/auth/users', { method: 'POST', body: JSON.stringify(data) }),
  updatePermissions: (id, permissions) =>
    apiFetch(`/api/auth/users/${id}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions }) }),
  setStatus: (id, is_active) =>
    apiFetch(`/api/auth/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ is_active }) }),
}

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
