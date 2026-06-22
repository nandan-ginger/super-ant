import { useState, useEffect } from 'react'
import { widgets as widgetsApi } from '@/api/client'

// Shared hook to fetch widgets list (used in multiple pages)
let _cache = null
let _pending = null

export function useWidgets() {
  const [widgets, setWidgets] = useState(_cache || [])
  const [loading, setLoading] = useState(!_cache)
  const [error, setError] = useState(null)

  const refresh = async () => {
    setLoading(true)
    try {
      if (!_pending) {
        _pending = widgetsApi.list({ limit: 500 })
      }
      const data = await _pending
      _pending = null
      _cache = data.widgets || []
      setWidgets(_cache)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!_cache) refresh()
  }, [])

  const invalidate = () => {
    _cache = null
    refresh()
  }

  return { widgets, loading, error, refresh: invalidate }
}
