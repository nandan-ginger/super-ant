import { useState, useCallback } from 'react'
import {
  HiPlus, HiPencil, HiTrash, HiDocumentDuplicate, HiPuzzlePiece,
  HiCheck, HiLink, HiCalendarDays,
} from 'react-icons/hi2'
import { widgets as widgetsApi } from '@/api/client'
import { Modal } from '@/components/ui/Modal'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/context/ToastContext'
import { useWidgets } from '@/hooks/useWidgets'
import { fmtDate } from '@/utils/format'

// ── Widget Form ───────────────────────────────────────────────────────────────
function WidgetForm({ values, onChange }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5 tracking-wide uppercase">Widget Name *</label>
        <input
          type="text"
          required
          placeholder="My Company Website"
          value={values.name}
          onChange={e => onChange('name', e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5 tracking-wide uppercase">Website URL *</label>
        <input
          type="url"
          required
          placeholder="https://example.com"
          value={values.url}
          onChange={e => onChange('url', e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5 tracking-wide uppercase">Description</label>
        <textarea
          placeholder="Optional description…"
          rows={3}
          value={values.description}
          onChange={e => onChange('description', e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all resize-none"
        />
      </div>
    </div>
  )
}

// ── Script Modal ──────────────────────────────────────────────────────────────
function ScriptModal({ open, onClose, script }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(script).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Embed Script"
      size="lg"
      footer={
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
          Close
        </button>
      }
    >
      <p className="text-sm text-slate-500 mb-4">
        Paste this snippet in the <code className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono">&lt;head&gt;</code> of your website to embed the chat widget.
      </p>
      <div className="relative">
        <div className="code-block text-xs leading-relaxed">{script}</div>
        <button
          onClick={copy}
          className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            copied
              ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
              : 'bg-white/10 border border-white/15 text-white/70 hover:bg-white/20 hover:text-white'
          }`}
        >
          {copied ? <HiCheck className="w-3.5 h-3.5" /> : <HiDocumentDuplicate className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </Modal>
  )
}

// ── Widget Card ───────────────────────────────────────────────────────────────
function WidgetCard({ widget, onEdit, onDelete, onScript }) {
  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
      {/* Top accent line */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-purple" />

      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
          <HiPuzzlePiece className="w-5 h-5 text-brand-600" />
        </div>
        <Badge variant="green">Active</Badge>
      </div>

      <h3 className="font-bold text-slate-800 text-base mb-1">{widget.name}</h3>
      <p className="text-xs text-slate-400 flex items-center gap-1 mb-1">
        <HiLink className="w-3 h-3" />
        <span className="truncate">{widget.url}</span>
      </p>
      {widget.description && (
        <p className="text-xs text-slate-500 mt-2 line-clamp-2">{widget.description}</p>
      )}

      <div className="mt-3 mb-4">
        <code className="text-[11px] font-mono bg-slate-100 text-brand-600 px-2.5 py-1 rounded-lg break-all">
          {widget.widget_code}
        </code>
      </div>

      <p className="text-[11px] text-slate-400 flex items-center gap-1 mb-4">
        <HiCalendarDays className="w-3 h-3" />
        Created {fmtDate(widget.created_at)}
      </p>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onScript(widget)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
        >
          <HiDocumentDuplicate className="w-3.5 h-3.5" />
          Script
        </button>
        <button
          onClick={() => onEdit(widget)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors"
        >
          <HiPencil className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          onClick={() => onDelete(widget)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold transition-colors border border-rose-100"
        >
          <HiTrash className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>
    </div>
  )
}

// ── Widgets Page ──────────────────────────────────────────────────────────────
const EMPTY_FORM = { name: '', url: '', description: '' }

export default function Widgets() {
  const toast = useToast()
  const { widgets, loading, refresh } = useWidgets()

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen,   setEditOpen]   = useState(false)
  const [scriptOpen, setScriptOpen] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [editCode,   setEditCode]   = useState('')
  const [scriptCode, setScriptCode] = useState('')

  const handleField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleCreate = async () => {
    if (!form.name || !form.url) { toast.error('Name and URL are required.'); return }
    setSaving(true)
    try {
      await widgetsApi.create(form)
      toast.success('Widget created!')
      setCreateOpen(false)
      setForm(EMPTY_FORM)
      refresh()
    } catch (err) {
      toast.error('Failed to create widget: ' + err.message)
    } finally { setSaving(false) }
  }

  const openEdit = (w) => {
    setForm({ name: w.name, url: w.url, description: w.description || '' })
    setEditCode(w.widget_code)
    setEditOpen(true)
  }

  const handleUpdate = async () => {
    if (!form.name || !form.url) { toast.error('Name and URL are required.'); return }
    setSaving(true)
    try {
      await widgetsApi.update(editCode, form)
      toast.success('Widget updated!')
      setEditOpen(false)
      refresh()
    } catch (err) {
      toast.error('Failed to update widget: ' + err.message)
    } finally { setSaving(false) }
  }

  const handleDelete = async (w) => {
    if (!confirm(`Delete widget "${w.name}"? This cannot be undone.`)) return
    try {
      await widgetsApi.delete(w.widget_code)
      toast.success('Widget deleted.')
      refresh()
    } catch (err) {
      toast.error('Failed to delete: ' + err.message)
    }
  }

  const openScript = (w) => {
    setScriptCode(w.script_code || '')
    setScriptOpen(true)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div />
        <button
          onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-purple text-white text-sm font-semibold shadow-purple hover:shadow-purple-lg transition-all hover:-translate-y-0.5"
        >
          <HiPlus className="w-4 h-4" />
          Create Widget
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <LoadingState message="Loading widgets…" />
      ) : widgets.length === 0 ? (
        <EmptyState
          icon={HiPuzzlePiece}
          title="No widgets yet"
          description="Create your first widget to start embedding the chatbot on your website."
          action={
            <button
              onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true) }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-purple text-white text-sm font-semibold shadow-purple"
            >
              <HiPlus className="w-4 h-4" />
              Create Widget
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {widgets.map(w => (
            <WidgetCard
              key={w.widget_code}
              widget={w}
              onEdit={openEdit}
              onDelete={handleDelete}
              onScript={openScript}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Widget"
        footer={
          <>
            <button onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-gradient-purple text-white text-sm font-semibold shadow-purple disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Create Widget
            </button>
          </>
        }
      >
        <WidgetForm values={form} onChange={handleField} />
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Widget"
        footer={
          <>
            <button onClick={() => setEditOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-gradient-purple text-white text-sm font-semibold shadow-purple disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Save Changes
            </button>
          </>
        }
      >
        <WidgetForm values={form} onChange={handleField} />
      </Modal>

      {/* Script Modal */}
      <ScriptModal open={scriptOpen} onClose={() => setScriptOpen(false)} script={scriptCode} />
    </div>
  )
}
