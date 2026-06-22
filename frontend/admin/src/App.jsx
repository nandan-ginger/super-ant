import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import { AppLayout } from '@/components/Layout/AppLayout'
import Login      from '@/pages/Login'
import Dashboard  from '@/pages/Dashboard'
import Widgets    from '@/pages/Widgets'
import LiveChats  from '@/pages/LiveChats'
import Leads      from '@/pages/Leads'
import Visitors   from '@/pages/Visitors'
import AdminUsers from '@/pages/AdminUsers'

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter basename="/admin">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/widgets"   element={<Widgets />} />
              <Route path="/chats"     element={<LiveChats />} />
              <Route path="/leads"     element={<Leads />} />
              <Route path="/visitors"  element={<Visitors />} />
              <Route path="/users"     element={<AdminUsers />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
