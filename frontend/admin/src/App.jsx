import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import { AppLayout } from '@/components/Layout/AppLayout'

// ── Common pages ──────────────────────────────────────────────────────────────
import Login      from '@/pages/common/Login'
import ProductHub from '@/pages/common/ProductHub'
import AdminUsers from '@/pages/common/AdminUsers'

// ── Chatbot product pages ─────────────────────────────────────────────────────
import Dashboard      from '@/pages/chatbot/Dashboard'
import Widgets        from '@/pages/chatbot/Widgets'
import PageManagement from '@/pages/chatbot/PageManagement'
import LiveChats      from '@/pages/chatbot/LiveChats'
import Leads          from '@/pages/chatbot/Leads'
import Visitors       from '@/pages/chatbot/Visitors'

// ── Review Agent product pages ────────────────────────────────────────────────
import ReviewDashboard   from '@/pages/review-agent/Dashboard'
import ReviewList        from '@/pages/review-agent/Reviews'
import ReviewEscalations from '@/pages/review-agent/Escalations'

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter basename="/admin">
          <Routes>
            {/* ── Public ──────────────────────────────────────────────────── */}
            <Route path="/login" element={<Login />} />

            {/* ── Product Hub (requires auth, no sidebar) ──────────────────── */}
            <Route path="/" element={<AppLayout hub />}>
              <Route index element={<ProductHub />} />
            </Route>

            {/* ── Common admin (requires auth, with sidebar) ───────────────── */}
            <Route element={<AppLayout />}>
              <Route path="/users" element={<AdminUsers />} />
            </Route>

            {/* ── Chatbot product namespace (requires auth, with sidebar) ───── */}
            <Route element={<AppLayout />}>
              <Route path="/chatbot/dashboard"        element={<Dashboard />} />
              <Route path="/chatbot/widgets"          element={<Widgets />} />
              <Route path="/chatbot/page-management" element={<PageManagement />} />
              <Route path="/chatbot/chats"           element={<LiveChats />} />
              <Route path="/chatbot/leads"           element={<Leads />} />
              <Route path="/chatbot/visitors"        element={<Visitors />} />
              {/* Default chatbot route */}
              <Route path="/chatbot" element={<Navigate to="/chatbot/dashboard" replace />} />
            </Route>

            {/* ── Review Agent product namespace (requires auth, with sidebar) ── */}
            <Route element={<AppLayout />}>
              <Route path="/review-agent/dashboard" element={<ReviewDashboard />} />
              <Route path="/review-agent/reviews"   element={<ReviewList />} />
              <Route path="/review-agent/escalations" element={<ReviewEscalations />} />
              {/* Default review-agent route */}
              <Route path="/review-agent" element={<Navigate to="/review-agent/dashboard" replace />} />
            </Route>

            {/* ── Legacy redirects (old flat paths → new namespaced paths) ──── */}
            <Route path="/dashboard" element={<Navigate to="/chatbot/dashboard" replace />} />
            <Route path="/widgets"   element={<Navigate to="/chatbot/widgets"   replace />} />
            <Route path="/chats"     element={<Navigate to="/chatbot/chats"     replace />} />
            <Route path="/leads"     element={<Navigate to="/chatbot/leads"     replace />} />
            <Route path="/visitors"  element={<Navigate to="/chatbot/visitors"  replace />} />

            {/* ── Catch-all ───────────────────────────────────────────────── */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
