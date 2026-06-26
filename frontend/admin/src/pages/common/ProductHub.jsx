import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  HiChatBubbleLeftRight,
  HiArrowRightOnRectangle,
  HiArrowRight,
  HiSparkles,
  HiStar,
} from 'react-icons/hi2'

// ── Product Registry ──────────────────────────────────────────────────────────
// To add a new product: add an entry here with its route, icon, and metadata.
const PRODUCTS = [
  {
    id: 'chatbot',
    name: 'Chatbot',
    route: '/chatbot/dashboard',
    description:
      'Manage live chat widgets, monitor visitor conversations, review leads, and configure your AI-powered chatbot.',
    icon: HiChatBubbleLeftRight,
    gradient: 'from-violet-600 to-indigo-600',
    glow: 'shadow-violet-500/30',
    badge: 'Active',
    badgeVariant: 'emerald',
    features: ['Live Chats', 'Widgets', 'Leads', 'Visitors'],
  },
  {
    id: 'review-agent',
    name: 'Review Agent',
    route: '/review-agent/dashboard',
    description:
      'Automated review analysis, sentiment detection, and AI-powered replies across Google, ReviewTreasures, and more.',
    icon: HiStar,
    gradient: 'from-amber-500 to-orange-500',
    glow: 'shadow-amber-500/30',
    badge: 'Active',
    badgeVariant: 'emerald',
    features: ['Sentiment Analysis', 'Auto Reply', 'Escalation Alerts', 'Multi-Platform'],
  },
]

function getInitials(name = '') {
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

export default function ProductHub() {
  const { admin, logout, isSuperAdmin } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    sessionStorage.removeItem('activeProduct')
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#070c1a] relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -top-64 -right-64 w-[700px] h-[700px] rounded-full bg-violet-700/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-indigo-700/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1px] bg-gradient-to-r from-transparent via-violet-500/20 to-transparent pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-purple flex items-center justify-center shadow-purple flex-shrink-0">
            <span className="text-xl">🐜</span>
          </div>
          <div>
            <div className="text-lg font-extrabold text-slate-50 tracking-tight">SuperAnt</div>
            <div className="text-[10px] text-slate-500 tracking-widest uppercase">Management Platform</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Admin badge */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
            <div className="w-6 h-6 rounded-full bg-gradient-purple flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
              {getInitials(admin?.username)}
            </div>
            <span className="text-[12px] text-slate-300 font-medium">{admin?.username}</span>
            {isSuperAdmin && (
              <span className="text-[10px] font-semibold text-violet-400 bg-violet-400/10 px-1.5 py-0.5 rounded-full">
                Super Admin
              </span>
            )}
          </div>

          {/* Admin Users link for super admins */}
          {isSuperAdmin && (
            <button
              id="hub-admin-users-btn"
              onClick={() => navigate('/users')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.10] text-slate-400 text-xs font-medium hover:bg-white/[0.07] hover:text-slate-200 transition-all"
            >
              Admin Users
            </button>
          )}

          <button
            id="hub-logout-btn"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-400 text-xs font-medium hover:bg-rose-400/10 transition-colors"
          >
            <HiArrowRightOnRectangle className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-6 py-16">
        {/* Hero text */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold tracking-wide mb-5">
            <HiSparkles className="w-3.5 h-3.5" />
            Platform Hub
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">
            Choose your product
          </h1>
          <p className="text-slate-400 text-base max-w-md mx-auto leading-relaxed">
            Select a product below to access its dashboard and management tools.
          </p>
        </div>

        {/* Product cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl">
          {PRODUCTS.map((product) => {
            const Icon = product.icon
            return (
              <button
                key={product.id}
                id={`hub-product-${product.id}`}
                onClick={() => navigate(product.route)}
                className="group relative text-left rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 hover:bg-white/[0.07] hover:border-white/[0.15] transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                {/* Badge */}
                <div className="absolute top-4 right-4">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    product.badge === 'Active'
                      ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                      : 'bg-slate-600/30 text-slate-400 border border-slate-600/30'
                  }`}>
                    {product.badge}
                  </span>
                </div>

                {/* Product icon */}
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${product.gradient} flex items-center justify-center mb-5 shadow-lg ${product.glow} group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>

                {/* Name & description */}
                <h2 className="text-lg font-bold text-white mb-2 group-hover:text-violet-200 transition-colors">
                  {product.name}
                </h2>
                <p className="text-[13px] text-slate-400 leading-relaxed mb-5">
                  {product.description}
                </p>

                {/* Feature tags */}
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {product.features.map((f) => (
                    <span key={f} className="text-[10px] font-semibold text-slate-400 bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 rounded-full">
                      {f}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                <div className="flex items-center gap-2 text-violet-400 text-[13px] font-semibold group-hover:gap-3 transition-all">
                  Open Dashboard
                  <HiArrowRight className="w-4 h-4" />
                </div>
              </button>
            )
          })}

          {/* "More coming soon" placeholder card */}
          <div className="relative text-left rounded-2xl border border-dashed border-white/[0.08] bg-transparent p-6 flex flex-col items-center justify-center min-h-[260px] opacity-50">
            <div className="w-12 h-12 rounded-2xl border border-dashed border-white/20 flex items-center justify-center mb-4">
              <span className="text-2xl">＋</span>
            </div>
            <p className="text-[13px] text-slate-500 text-center font-medium">More products<br />coming soon</p>
          </div>
        </div>
      </main>
    </div>
  )
}
