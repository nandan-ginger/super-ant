import { apiFetch } from '../core'

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
