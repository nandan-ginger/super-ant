import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { auth, setUnauthorizedHandler } from '@/api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    localStorage.removeItem('sa_token')
    localStorage.removeItem('sa_admin')
    setAdmin(null)
  }, [])

  // Register 401 handler
  useEffect(() => {
    setUnauthorizedHandler(logout)
  }, [logout])

  // Restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem('sa_token')
    const stored = localStorage.getItem('sa_admin')
    if (!token || !stored) {
      setLoading(false)
      return
    }
    // Verify token is still valid
    auth.me()
      .then(() => {
        setAdmin(JSON.parse(stored))
      })
      .catch(() => {
        localStorage.removeItem('sa_token')
        localStorage.removeItem('sa_admin')
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (username, password) => {
    const data = await auth.login(username, password)
    localStorage.setItem('sa_token', data.token)
    localStorage.setItem('sa_admin', JSON.stringify(data.admin))
    setAdmin(data.admin)
    return data.admin
  }

  const isSuperAdmin = admin?.role === 'superadmin'

  return (
    <AuthContext.Provider value={{ admin, login, logout, loading, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
