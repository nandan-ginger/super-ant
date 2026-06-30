import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { Spinner } from '@/components/ui/Spinner'
import logo from '@/assets/logo.png'

export function AppLayout({ action, hub = false }) {
  const { admin, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-purple flex items-center justify-center shadow-purple">
            <img src={logo} alt="Logo" className="w-7 h-7 object-contain" />
          </div>
          <Spinner size="md" />
        </div>
      </div>
    )
  }

  if (!admin) {
    return <Navigate to="/login" replace />
  }

  // Hub mode — no sidebar or topbar (ProductHub has its own header)
  if (hub) {
    return <Outlet />
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-60 min-h-screen">
        <Topbar action={action} />
        <main className="flex-1 p-7">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

