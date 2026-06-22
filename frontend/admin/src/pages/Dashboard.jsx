import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line, Doughnut, Bar } from 'react-chartjs-2'
import {
  HiPuzzlePiece, HiChatBubbleLeftRight, HiUserGroup, HiEnvelope,
} from 'react-icons/hi2'
import { MdLeaderboard } from 'react-icons/md'
import { dashboard, leads as leadsApi, livechats } from '@/api/client'
import { StatCard } from '@/components/ui/StatCard'
import { LoadingState } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/context/ToastContext'
import { fmtDate, fmtRelative, getInitials } from '@/utils/format'
import { useWidgets } from '@/hooks/useWidgets'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
)

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
}

const PIE_COLORS = [
  '#7c3aed','#3b82f6','#10b981','#f59e0b','#f43f5e','#06b6d4','#8b5cf6','#f97316',
]

function fillLast7Days(data) {
  const today = new Date()
  const map = {}
  data.forEach(d => { map[d.date] = d.count })
  const labels = [], values = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    labels.push(d.toLocaleDateString('en', { month: 'short', day: 'numeric' }))
    values.push(map[key] || 0)
  }
  return { labels, values }
}

export default function Dashboard() {
  const toast   = useToast()
  const navigate = useNavigate()
  const { widgets } = useWidgets()

  const [stats,    setStats]    = useState(null)
  const [recentLeads, setRecentLeads] = useState([])
  const [recentSessions, setRecentSessions] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [s, l] = await Promise.all([
          dashboard.stats(),
          leadsApi.list({ limit: 8, offset: 0 }),
        ])
        setStats(s)
        setRecentLeads(l.leads || [])
      } catch (err) {
        toast.error('Failed to load dashboard: ' + err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Load recent sessions once widgets are available
  useEffect(() => {
    if (!widgets?.length) return
    livechats.sessions(widgets[0].widget_code, { limit: 8 })
      .then(d => setRecentSessions(d.sessions || []))
      .catch(() => {})
  }, [widgets])

  if (loading) return <LoadingState message="Loading dashboard…" />

  const { labels: l7Labels, values: l7Values } = fillLast7Days(stats?.leads_last_7_days || [])
  const intentData = stats?.leads_by_intent || []
  const widgetData = stats?.sessions_per_widget || []

  const lineData = {
    labels: l7Labels,
    datasets: [{
      label: 'Leads',
      data: l7Values,
      fill: true,
      borderColor: '#7c3aed',
      backgroundColor: 'rgba(124,58,237,0.1)',
      borderWidth: 2.5,
      pointBackgroundColor: '#7c3aed',
      pointRadius: 4,
      tension: 0.4,
    }],
  }

  const intentChartData = {
    labels: intentData.length ? intentData.map(d => d.intent) : ['No data'],
    datasets: [{
      data: intentData.length ? intentData.map(d => d.count) : [1],
      backgroundColor: PIE_COLORS,
      borderWidth: 0,
      hoverOffset: 6,
    }],
  }

  const barData = {
    labels: widgetData.map(d => d.name || d.widget_code),
    datasets: [{
      label: 'Sessions',
      data: widgetData.map(d => d.session_count),
      backgroundColor: PIE_COLORS,
      borderRadius: 6,
      borderSkipped: false,
    }],
  }

  const intentOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { boxWidth: 10, padding: 12, font: { size: 11 } } },
    },
    cutout: '65%',
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard label="Total Widgets"     value={stats?.total_widgets}       sub="Registered sites"        icon={HiPuzzlePiece}          gradient="bg-gradient-purple" />
        <StatCard label="Total Sessions"    value={stats?.total_sessions}      sub={`${stats?.sessions_today} today`} icon={HiChatBubbleLeftRight} gradient="bg-gradient-blue" />
        <StatCard label="Total Leads"       value={stats?.total_leads}         sub={`${stats?.leads_today} today`}    icon={MdLeaderboard}          gradient="bg-gradient-green" />
        <StatCard label="Identified Visitors" value={stats?.sessions_with_leads} sub="Sessions w/ leads"      icon={HiUserGroup}            gradient="bg-gradient-amber" />
        <StatCard label="Total Messages"    value={stats?.total_messages}      sub="All time"                icon={HiEnvelope}             gradient="bg-gradient-rose" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-card">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Leads — Last 7 Days</h3>
          <div className="h-48">
            <Line data={lineData} options={{ ...CHART_OPTS, scales: { x: { grid: { display: false }, ticks: { font: { size: 11 } } }, y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } }, grid: { color: '#f1f5f9' } } } }} />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Leads by Intent</h3>
          <div className="h-48">
            <Doughnut data={intentChartData} options={intentOpts} />
          </div>
        </div>
      </div>

      {/* Sessions per Widget */}
      {widgetData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Sessions per Widget</h3>
          <div className="h-40">
            <Bar data={barData} options={{ ...CHART_OPTS, scales: { x: { grid: { display: false }, ticks: { font: { size: 11 } } }, y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } }, grid: { color: '#f1f5f9' } } } }} />
          </div>
        </div>
      )}

      {/* Recent Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Leads */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-700">Recent Leads</h3>
            <button onClick={() => navigate('/leads')} className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors">View All →</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Email</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Intent</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Captured</th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-10 text-slate-400 text-sm">No leads yet</td></tr>
                ) : recentLeads.map(l => (
                  <tr key={l.id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-semibold text-slate-700">{l.name || '—'}</td>
                    <td className="px-5 py-3 text-slate-400">{l.email || '—'}</td>
                    <td className="px-5 py-3">
                      {l.intent ? <Badge variant="purple">{l.intent}</Badge> : '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-400">{fmtDate(l.captured_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-700">Recent Sessions</h3>
            <button onClick={() => navigate('/chats')} className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors">View All →</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Visitor</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Messages</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-10 text-slate-400 text-sm">No sessions yet</td></tr>
                ) : recentSessions.map(s => (
                  <tr key={s.id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-purple flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                          {getInitials(s.display_name)}
                        </div>
                        <span className="font-medium text-slate-700 truncate max-w-[120px]">{s.display_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-400">{s.message_count}</td>
                    <td className="px-5 py-3 text-slate-400">{fmtRelative(s.last_active)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
