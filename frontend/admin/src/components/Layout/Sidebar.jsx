import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  HiSquares2X2,
  HiPuzzlePiece,
  HiChatBubbleLeftRight,
  HiUserGroup,
  HiUsers,
  HiArrowRightOnRectangle,
  HiChevronRight,
} from 'react-icons/hi2'
import { MdLeaderboard } from 'react-icons/md'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: HiSquares2X2, section: 'Overview' },
  { to: '/widgets',   label: 'Widgets',   icon: HiPuzzlePiece, section: 'Manage' },
  { to: '/chats',     label: 'Live Chats', icon: HiChatBubbleLeftRight, section: null },
  { to: '/leads',     label: 'Leads',     icon: MdLeaderboard, section: null },
  { to: '/visitors',  label: 'Visitors',  icon: HiUserGroup, section: null },
  { to: '/users',     label: 'Admin Users', icon: HiUsers, section: 'Admin', superAdminOnly: true },
]

function getInitials(name = '') {
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

export function Sidebar() {
  const { admin, logout, isSuperAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  let lastSection = null

  return (
    <aside className="fixed inset-y-0 left-0 w-60 flex flex-col bg-[#0f172a] z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-7 border-b border-white/[0.06]">
        <div className="w-9 h-9 rounded-xl bg-gradient-purple flex items-center justify-center flex-shrink-0 shadow-purple">
          <span className="text-lg">🐜</span>
        </div>
        <div>
          <div className="text-[17px] font-extrabold text-slate-50 tracking-tight">SuperAnt</div>
          <div className="text-[10px] text-slate-400 tracking-widest uppercase mt-0.5">Admin Dashboard</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto space-y-0.5">
        {NAV_ITEMS.map((item) => {
          if (item.superAdminOnly && !isSuperAdmin) return null

          const showSection = item.section && item.section !== lastSection
          if (item.section) lastSection = item.section

          return (
            <div key={item.to}>
              {showSection && (
                <p className="text-[10px] font-semibold tracking-[0.08em] uppercase text-slate-500/60 px-2.5 pt-4 pb-1.5">
                  {item.section}
                </p>
              )}
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all duration-150 group ${
                    isActive
                      ? 'bg-brand-600/20 text-brand-300 nav-active-indicator'
                      : 'text-slate-400 hover:bg-white/[0.07] hover:text-slate-200'
                  }`
                }
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
              </NavLink>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-2.5 py-3 border-t border-white/[0.06] space-y-1">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-purple flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {getInitials(admin?.username)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-slate-200 truncate">{admin?.username}</p>
            <p className="text-[11px] text-slate-400 capitalize">
              {admin?.role === 'superadmin' ? 'Super Admin' : 'Admin'}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-rose-400 hover:bg-rose-400/10 transition-colors"
        >
          <HiArrowRightOnRectangle className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
