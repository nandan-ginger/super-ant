import { useState, useEffect } from 'react'
import { HiUserGroup, HiCheckBadge } from 'react-icons/hi2'
import { visitors as visitorsApi } from '@/api/client'
import { Modal } from '@/components/ui/Modal'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { useToast } from '@/context/ToastContext'
import { useWidgets } from '@/hooks/useWidgets'
import { fmtDate, fmtRelative, getInitials } from '@/utils/format'

const LIMIT = 25

// ── Visitor Detail Modal ──────────────────────────────────────────────────────
function VisitorDetailModal({ sessionId, open, onClose }) {
  const [visitor, setVisitor] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !sessionId) return
    setVisitor(null)
    setLoading(true)
    visitorsApi.get(sessionId)
      .then(d => setVisitor(d.visitor))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, sessionId])

  const rows = visitor ? [
    { label: 'Name',          value: visitor.display_name },
    { label: 'Email',         value: visitor.email },
    { label: 'Phone',         value: visitor.phone },
    { label: 'Intent',        value: visitor.intent ? <Badge variant="purple">{visitor.intent}</Badge> : null },
    { label: 'Requirement',   value: visitor.requirement },
    { label: 'Page Title',    value: visitor.page_title },
    { label: 'Page URL',      value: visitor.page_url ? <a href={visitor.page_url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline break-all">{visitor.page_url}</a> : null },
    { label: 'Widget',        value: visitor.widget_code ? <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">{visitor.widget_code}</code> : null },
    { label: 'Messages',      value: visitor.message_count },
    { label: 'Has Lead',      value: visitor.has_lead ? <Badge variant="green">Yes</Badge> : <Badge variant="gray">No</Badge> },
    { label: 'Lead Captured', value: visitor.lead_captured_at ? fmtDate(visitor.lead_captured_at) : null },
    { label: 'Session ID',    value: <code className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded font-mono break-all">{visitor.session_id}</code> },
    { label: 'Started',       value: fmtDate(visitor.started_at) },
    { label: 'Last Active',   value: fmtDate(visitor.last_active) },
  ] : []

  return (
    <Modal open={open} onClose={onClose} title="Visitor Detail" footer={
      <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
        Close
      </button>
    }>
      {loading ? <LoadingState /> : visitor ? (
        <div className="divide-y divide-slate-100">
          {rows.map(r => (
            r.value != null && (
              <div key={r.label} className="flex gap-4 py-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide w-32 flex-shrink-0 pt-0.5">{r.label}</span>
                <span className="text-[13.5px] text-slate-700 flex-1">{r.value}</span>
              </div>
            )
          ))}
        </div>
      ) : <EmptyState icon={HiUserGroup} title="Visitor not found" />}
    </Modal>
  )
}

// ── Visitors Page ─────────────────────────────────────────────────────────────
export default function Visitors() {
  const toast = useToast()
  const { widgets, loading: widgetsLoading } = useWidgets()

  const [widgetCode, setWidgetCode] = useState('')
  const [visitors,   setVisitors]   = useState([])
  const [total,      setTotal]      = useState(0)
  const [offset,     setOffset]     = useState(0)
  const [loading,    setLoading]    = useState(false)
  const [detailId,   setDetailId]   = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const load = async (wCode, newOffset = 0) => {
    if (!wCode) return
    setLoading(true)
    try {
      const data = await visitorsApi.list(wCode, { limit: LIMIT, offset: newOffset })
      setVisitors(data.visitors || [])
      setTotal(data.total || 0)
      setOffset(newOffset)
    } catch (err) {
      toast.error('Failed to load visitors: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (widgetCode) load(widgetCode, 0)
  }, [widgetCode])

  const openDetail = (sessionId) => {
    setDetailId(sessionId)
    setDetailOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Widget selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-semibold text-slate-500">Widget:</label>
        <select
          value={widgetCode}
          onChange={e => setWidgetCode(e.target.value)}
          className="min-w-[220px] px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
        >
          <option value="">— Select a widget —</option>
          {widgets.map(w => <option key={w.widget_code} value={w.widget_code}>{w.name}</option>)}
        </select>
        {total > 0 && <span className="text-sm text-slate-400">{total} visitor{total !== 1 ? 's' : ''}</span>}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50">
                {['Visitor', 'Email', 'Page', 'Messages', 'Lead', 'Last Active'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!widgetCode ? (
                <tr><td colSpan={6}><EmptyState icon={HiUserGroup} title="Select a widget" description="Choose a widget above to view its visitors." /></td></tr>
              ) : loading ? (
                <tr><td colSpan={6}><LoadingState /></td></tr>
              ) : visitors.length === 0 ? (
                <tr><td colSpan={6}><EmptyState icon={HiUserGroup} title="No visitors yet" description="Visitors will appear here once people use your widget." /></td></tr>
              ) : visitors.map(v => (
                <tr
                  key={v.session_id}
                  onClick={() => openDetail(v.session_id)}
                  className="border-t border-slate-50 hover:bg-brand-50/30 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-purple flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                        {getInitials(v.display_name)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{v.display_name}</p>
                        {v.has_lead && <Badge variant="green" size="sm" className="mt-0.5">Lead</Badge>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{v.email || '—'}</td>
                  <td className="px-5 py-3.5 text-slate-500 max-w-[160px] truncate">
                    {v.page_title || v.page_url || '—'}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{v.message_count}</td>
                  <td className="px-5 py-3.5">
                    {v.has_lead
                      ? <Badge variant="green"><HiCheckBadge className="w-3 h-3 mr-1" />Yes</Badge>
                      : <Badge variant="gray">No</Badge>
                    }
                  </td>
                  <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap">{fmtRelative(v.last_active)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {widgetCode && (
          <Pagination total={total} limit={LIMIT} offset={offset} onPageChange={(o) => load(widgetCode, o)} />
        )}
      </div>

      <VisitorDetailModal sessionId={detailId} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </div>
  )
}
