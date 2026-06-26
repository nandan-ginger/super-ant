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
