// Shared utility functions

export function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })
}

export function fmtTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
}

export function fmtRelative(d) {
  if (!d) return '—'
  const diff = Date.now() - new Date(d).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export function getInitials(name = '') {
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2) || '?'
}

export function escapeHtml(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function exportCSV(rows, headers, filename) {
  const lines = [
    headers.join(','),
    ...rows.map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
