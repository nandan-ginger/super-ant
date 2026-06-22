import { useLocation } from 'react-router-dom'
import { HiBell, HiMagnifyingGlass } from 'react-icons/hi2'
import { useAuth } from '@/context/AuthContext'

const PAGE_META = {
  '/dashboard': { title: 'Dashboard',    subtitle: 'Platform overview & analytics' },
  '/widgets':   { title: 'Widgets',      subtitle: 'Manage your chat widget installations' },
  '/chats':     { title: 'Live Chats',   subtitle: 'Browse visitor conversations' },
  '/leads':     { title: 'Leads',        subtitle: 'Captured contact information' },
  '/visitors':  { title: 'Visitors',     subtitle: 'All website visitors' },
  '/users':     { title: 'Admin Users',  subtitle: 'Manage administrator accounts' },
}

export function Topbar({ action }) {
  const { pathname } = useLocation()
  const meta = PAGE_META[pathname] || { title: pathname.slice(1), subtitle: '' }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-7 h-16 flex items-center justify-between shadow-sm">
      <div>
        <h1 className="text-lg font-bold text-slate-800 tracking-tight">{meta.title}</h1>
        <p className="text-xs text-slate-400 mt-0.5">{meta.subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        {action}
      </div>
    </header>
  )
}
