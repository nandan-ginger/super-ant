import { useState, useEffect } from 'react'
import { HiMagnifyingGlass, HiArrowDownTray, HiXMark } from 'react-icons/hi2'
import { MdLeaderboard } from 'react-icons/md'
import { leads as leadsApi } from '@/api/client'
import { Modal } from '@/components/ui/Modal'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { useToast } from '@/context/ToastContext'
import { useWidgets } from '@/hooks/useWidgets'
import { fmtDate, exportCSV } from '@/utils/format'

const LIMIT = 50
const INTENTS = ['pricing', 'demo', 'support', 'sales', 'general', 'inquiry', 'other']

// ── Lead Detail Modal ─────────────────────────────────────────────────────────
function LeadDetailModal({ id, open, onClose }) {
  const [lead,    setLead]    = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !id) return
    setLead(null)
    setLoading(true)
    leadsApi.get(id)
      .then(d => setLead(d.lead))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, id])

  const rows = lead ? [
    { label: 'Name',        value: lead.name },
    { label: 'Email',       value: lead.email },
    { label: 'Phone',       value: lead.phone },
    { label: 'Intent',      value: lead.intent ? <Badge variant="purple">{lead.intent}</Badge> : null },
    { label: 'Requirement', value: lead.requirement },
    { label: 'Page URL',    value: lead.page_url ? <a href={lead.page_url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline break-all">{lead.page_url}</a> : null },
    { label: 'Widget',      value: lead.widget_code ? <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">{lead.widget_code}</code> : null },
    { label: 'Session ID',  value: lead.session_id ? <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono break-all">{lead.session_id}</code> : null },
    { label: 'Captured',    value: fmtDate(lead.captured_at) },
  ] : []

  return (
    <Modal open={open} onClose={onClose} title="Lead Detail" footer={
      <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
        Close
      </button>
    }>
      {loading ? (
        <LoadingState />
      ) : lead ? (
        <div className="divide-y divide-slate-100">
          {rows.map(r => (
            r.value != null && (
              <div key={r.label} className="flex gap-4 py-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide w-28 flex-shrink-0 pt-0.5">{r.label}</span>
                <span className="text-[13.5px] text-slate-700 flex-1">{r.value}</span>
              </div>
            )
          ))}
        </div>
      ) : (
        <EmptyState icon={MdLeaderboard} title="Lead not found" />
      )}
    </Modal>
  )
}

// ── Leads Page ────────────────────────────────────────────────────────────────
export default function Leads() {
  const toast = useToast()
  const { widgets } = useWidgets()

  const [leads,      setLeads]      = useState([])
  const [total,      setTotal]      = useState(0)
  const [offset,     setOffset]     = useState(0)
  const [loading,    setLoading]    = useState(false)
  const [search,     setSearch]     = useState('')
  const [widgetFilter, setWidgetFilter] = useState('')
  const [intentFilter, setIntentFilter] = useState('')
  const [detailId,   setDetailId]   = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const load = async (newOffset = 0) => {
    setLoading(true)
    try {
      const params = { limit: LIMIT, offset: newOffset }
      if (widgetFilter) params.widgetCode = widgetFilter
      if (intentFilter) params.intent     = intentFilter
      const data = await leadsApi.list(params)
      setLeads(data.leads || [])
      setTotal(data.total || 0)
      setOffset(newOffset)
    } catch (err) {
      toast.error('Failed to load leads: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(0) }, [widgetFilter, intentFilter])

  const filtered = search
    ? leads.filter(l =>
        (l.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.phone || '').includes(search)
      )
    : leads

  const handleExport = () => {
    if (!leads.length) { toast.info('No leads to export.'); return }
    exportCSV(
      leads.map(l => [l.name, l.email, l.phone, l.intent, l.requirement, l.widget_code, l.page_url, l.captured_at]),
      ['Name', 'Email', 'Phone', 'Intent', 'Requirement', 'Widget', 'Page URL', 'Captured At'],
      `leads_${new Date().toISOString().split('T')[0]}.csv`
    )
    toast.success('Leads exported!')
  }

  const openDetail = (id) => { setDetailId(id); setDetailOpen(true) }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <HiXMark className="w-4 h-4" />
            </button>
          )}
        </div>

        <select
          value={widgetFilter}
          onChange={e => setWidgetFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
        >
          <option value="">All Widgets</option>
          {widgets.map(w => <option key={w.widget_code} value={w.widget_code}>{w.name}</option>)}
        </select>

        <select
          value={intentFilter}
          onChange={e => setIntentFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
        >
          <option value="">All Intents</option>
          {INTENTS.map(i => <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>)}
        </select>

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <HiArrowDownTray className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50">
                {['Name', 'Email', 'Phone', 'Intent', 'Requirement', 'Widget', 'Captured'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><LoadingState /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon={MdLeaderboard} title="No leads found" description="Try adjusting your filters." /></td></tr>
              ) : filtered.map(l => (
                <tr
                  key={l.id}
                  onClick={() => openDetail(l.id)}
                  className="border-t border-slate-50 hover:bg-brand-50/30 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5 font-semibold text-slate-800">{l.name || '—'}</td>
                  <td className="px-5 py-3.5 text-slate-500">{l.email || '—'}</td>
                  <td className="px-5 py-3.5 text-slate-500">{l.phone || '—'}</td>
                  <td className="px-5 py-3.5">
                    {l.intent ? <Badge variant="purple">{l.intent}</Badge> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 max-w-[180px] truncate">{l.requirement || '—'}</td>
                  <td className="px-5 py-3.5">
                    <code className="text-[11px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      {l.widget_code || '—'}
                    </code>
                  </td>
                  <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap">{fmtDate(l.captured_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination total={total} limit={LIMIT} offset={offset} onPageChange={load} />
      </div>

      <LeadDetailModal id={detailId} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </div>
  )
}
