import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { HiEye, HiEyeSlash, HiLockClosed, HiUser } from 'react-icons/hi2'
import { useAuth } from '@/context/AuthContext'

export default function Login() {
  const { admin, login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  if (admin) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.username, form.password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-ocean relative flex items-center justify-center p-5 overflow-hidden">
      {/* Background orbs */}
      <div className="absolute -top-48 -right-48 w-[500px] h-[500px] rounded-full bg-brand-600/25 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />

      <div className="relative z-10 glass rounded-3xl p-10 w-full max-w-md shadow-modal">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-purple flex items-center justify-center shadow-purple-lg">
            <span className="text-3xl">🐜</span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">SuperAnt</h1>
            <p className="text-xs text-white/40 tracking-widest uppercase mt-0.5">Admin Portal</p>
          </div>
        </div>

        <p className="text-xl font-bold text-white mb-1">Welcome back 👋</p>
        <p className="text-sm text-white/50 mb-7">Sign in to manage your chatbot platform</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-2 tracking-wide">
              Username or Email
            </label>
            <div className="relative">
              <HiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                required
                autoComplete="username"
                placeholder="superadmin"
                value={form.username}
                onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/7 border border-white/12 text-white placeholder-white/30 text-sm focus:outline-none focus:border-brand-500/80 focus:ring-2 focus:ring-brand-500/20 transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-2 tracking-wide">
              Password
            </label>
            <div className="relative">
              <HiLockClosed className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type={showPw ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full pl-10 pr-10 py-3 rounded-xl bg-white/7 border border-white/12 text-white placeholder-white/30 text-sm focus:outline-none focus:border-brand-500/80 focus:ring-2 focus:ring-brand-500/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPw(s => !s)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
              >
                {showPw ? <HiEyeSlash className="w-4 h-4" /> : <HiEye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-rose-500/15 border border-rose-500/25 px-4 py-3 text-rose-300 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-purple text-white font-semibold text-sm shadow-purple hover:shadow-purple-lg transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
