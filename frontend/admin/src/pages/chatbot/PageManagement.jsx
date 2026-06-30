import { useState, useEffect, useCallback } from 'react'
import {
  HiPlus, HiPencil, HiTrash, HiDocumentText,
  HiGlobeAlt, HiClock, HiChatBubbleLeftEllipsis,
  HiCheck, HiChevronDown,
} from 'react-icons/hi2'
import { pageRules as pageRulesApi, widgets as widgetsApi } from '@/api/client'
import { Modal } from '@/components/ui/Modal'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { useToast } from '@/context/ToastContext'

// ── Helpers ───────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  name: '',
  urlPath: '',
  popupDelaySeconds: '',
  welcomeMessage: '',
  staticContext: '',
  contextOnlyMode: false,
}

// ── Page Rule Form ────────────────────────────────────────────────────────────
function PageRuleForm({ values, onChange }) {
  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5 tracking-wide uppercase">
          Page Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          required
          placeholder="e.g. About Page"
          value={values.name}
          onChange={e => onChange('name', e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
        />
      </div>

      {/* URL Path */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5 tracking-wide uppercase">
          URL Path <span className="text-red-400">*</span> <span className="normal-case font-normal text-slate-400">(exact match, e.g. /about)</span>
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono select-none">/</span>
          <input
            type="text"
            required
            placeholder="about"
            value={values.urlPath.replace(/^\//, '')}
            onChange={e => onChange('urlPath', '/' + e.target.value.replace(/^\/+/, ''))}
            className="w-full pl-7 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 font-mono focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
          />
        </div>
        {/* <p className="text-[11px] text-slate-400 mt-1">
          Must match the exact pathname of the page on your website.
        </p> */}
      </div>

      {/* Popup Delay */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5 tracking-wide uppercase">
          Auto-Open Delay (seconds)
        </label>
        <input
          type="number"
          min="0"
          step="1"
          placeholder="Leave empty to disable auto-open"
          value={values.popupDelaySeconds}
          onChange={e => onChange('popupDelaySeconds', e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
        />
        {/* <p className="text-[11px] text-slate-400 mt-1">
          <span className="font-semibold">0</span> = open instantly on page load.
          Empty = the visitor must click the chat button (default).
        </p> */}
      </div>

      {/* Welcome Message Override */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5 tracking-wide uppercase">
          Welcome Message
        </label>
        <input
          type="text"
          placeholder='e.g. "Need any help contacting us?"'
          value={values.welcomeMessage}
          onChange={e => onChange('welcomeMessage', e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
        />
        {/* <p className="text-[11px] text-slate-400 mt-1">
          Overrides the default greeting shown when the chat first opens on this page.
        </p> */}
      </div>

      {/* Static Context */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5 tracking-wide uppercase">
          Context Of the Page
        </label>
        <textarea
          rows={5}
          placeholder="Enter the page-specific information the AI should know when answering questions on this page…"
          value={values.staticContext}
          onChange={e => onChange('staticContext', e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all resize-none"
        />
        <p className="text-[11px] text-slate-400 mt-1">
          This text is sent to the AI alongside (or instead of) Site content.
        </p>
      </div>

      {/* Context Only Mode */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-violet-50 border border-violet-100">
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-600">Context Only Mode</p>
          <p className="text-[11.5px] text-slate-600 mt-0.5">
            When enabled, the AI uses <strong>only</strong> the context above and site content is skipped entirely.
            When disabled,the above context is <em>merged</em> with site content.
          </p>
        </div>
        <ToggleSwitch
          checked={values.contextOnlyMode}
          onChange={v => onChange('contextOnlyMode', v)}
        />
      </div>
    </div>
  )
}

// ── Page Rule Card ────────────────────────────────────────────────────────────
function PageRuleCard({ rule, onEdit, onDelete }) {
  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
      {/* Top accent */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-purple" />

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
            <HiDocumentText className="w-4.5 h-4.5 text-violet-600" />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm leading-tight">{rule.name}</p>
            <code className="text-[11px] font-mono text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">
              {rule.urlPath}
            </code>
          </div>
        </div>

        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(rule)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
            title="Edit"
          >
            <HiPencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(rule)}
            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
            title="Delete"
          >
            <HiTrash className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-2 mt-3">
        {rule.popupDelaySeconds !== null && rule.popupDelaySeconds !== undefined ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
            <HiClock className="w-3 h-3" />
            {rule.popupDelaySeconds === 0 ? 'Opens instantly' : `Opens after ${rule.popupDelaySeconds}s`}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
            <HiClock className="w-3 h-3" />
            No auto-open
          </span>
        )}

        {rule.contextOnlyMode && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
            Context only
          </span>
        )}

        {rule.staticContext && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
            Context available
          </span>
        )}

        {rule.welcomeMessage && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
            <HiChatBubbleLeftEllipsis className="w-3 h-3" />
            Welcome message
          </span>
        )}
      </div>
    </div>
  )
}

// ── Widget Selector ───────────────────────────────────────────────────────────
function WidgetSelector({ widgets, selected, onSelect, loading }) {
  const [open, setOpen] = useState(false)
  const selectedWidget = widgets.find(w => w.widget_code === selected)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:border-brand-300 hover:bg-brand-50 transition-all shadow-sm min-w-56 justify-between"
      >
        <div className="flex items-center gap-2">
          <HiGlobeAlt className="w-4 h-4 text-brand-500" />
          <span className="truncate max-w-40">
            {loading ? 'Loading…' : (selectedWidget?.name || 'Select a widget')}
          </span>
        </div>
        <HiChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-72 bg-white rounded-xl border border-slate-200 shadow-lg z-10 overflow-hidden">
          {widgets.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No widgets found.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {widgets.map(w => (
                <button
                  key={w.widget_code}
                  onClick={() => { onSelect(w.widget_code); setOpen(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors ${selected === w.widget_code ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700'}`}
                >
                  {selected === w.widget_code && <HiCheck className="w-4 h-4 text-brand-500 flex-shrink-0" />}
                  <div className={selected === w.widget_code ? '' : 'ml-7'}>
                    <p className="font-medium leading-tight truncate">{w.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{w.url}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page Management Main ──────────────────────────────────────────────────────
export default function PageManagement() {
  const toast = useToast()

  // Widgets
  const [widgets, setWidgets] = useState([])
  const [widgetsLoading, setWidgetsLoading] = useState(true)
  const [selectedWidget, setSelectedWidget] = useState(null)

  // Page rules
  const [rules, setRules] = useState([])
  const [rulesLoading, setRulesLoading] = useState(false)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState(null) // null = create mode
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // ── Load widgets ─────────────────────────────────────────────────────────────
  useEffect(() => {
    widgetsApi.list({ limit: 500 })
      .then(data => {
        const list = data.widgets || []
        setWidgets(list)
        if (list.length > 0 && !selectedWidget) {
          setSelectedWidget(list[0].widget_code)
        }
      })
      .catch(err => toast.error('Failed to load widgets: ' + err.message))
      .finally(() => setWidgetsLoading(false))
  }, [])

  // ── Load rules for selected widget ───────────────────────────────────────────
  const loadRules = useCallback(async (widgetCode) => {
    if (!widgetCode) return
    setRulesLoading(true)
    try {
      const data = await pageRulesApi.list(widgetCode)
      setRules(data.rules || [])
    } catch (err) {
      toast.error('Failed to load page rules: ' + err.message)
    } finally {
      setRulesLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (selectedWidget) loadRules(selectedWidget)
  }, [selectedWidget, loadRules])

  // ── Form helpers ─────────────────────────────────────────────────────────────
  const handleField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const openCreate = () => {
    setEditingRule(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (rule) => {
    setEditingRule(rule)
    setForm({
      name: rule.name,
      urlPath: rule.urlPath,
      popupDelaySeconds: rule.popupDelaySeconds !== null && rule.popupDelaySeconds !== undefined
        ? String(rule.popupDelaySeconds) : '',
      welcomeMessage: rule.welcomeMessage || '',
      staticContext: rule.staticContext || '',
      contextOnlyMode: rule.contextOnlyMode || false,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Page name is required.'); return }
    if (!form.urlPath.trim() || form.urlPath === '/') { toast.error('URL path is required (e.g. /about).'); return }
    if (!selectedWidget) { toast.error('Please select a widget first.'); return }

    setSaving(true)
    try {
      const payload = {
        widgetCode: selectedWidget,
        name: form.name.trim(),
        urlPath: form.urlPath.trim(),
        popupDelaySeconds: form.popupDelaySeconds === '' ? null : Number(form.popupDelaySeconds),
        welcomeMessage: form.welcomeMessage.trim(),
        staticContext: form.staticContext.trim(),
        contextOnlyMode: form.contextOnlyMode,
      }

      if (editingRule) {
        await pageRulesApi.update(editingRule.id, payload)
        toast.success('Page rule updated!')
      } else {
        await pageRulesApi.create(payload)
        toast.success('Page rule created!')
      }

      setModalOpen(false)
      loadRules(selectedWidget)
    } catch (err) {
      toast.error(err.message || 'Failed to save page rule.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (rule) => {
    if (!confirm(`Delete page rule for "${rule.urlPath}"?`)) return
    try {
      await pageRulesApi.delete(rule.id)
      toast.success('Page rule deleted.')
      loadRules(selectedWidget)
    } catch (err) {
      toast.error('Failed to delete: ' + err.message)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <WidgetSelector
            widgets={widgets}
            selected={selectedWidget}
            onSelect={setSelectedWidget}
            loading={widgetsLoading}
          />
          {selectedWidget && !rulesLoading && (
            <span className="text-sm text-slate-400">
              {rules.length} page {rules.length === 1 ? 'rule' : 'rules'}
            </span>
          )}
        </div>

        {selectedWidget && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-purple text-white text-sm font-semibold shadow-purple hover:shadow-purple-lg transition-all hover:-translate-y-0.5"
          >
            <HiPlus className="w-4 h-4" />
            Add Page Rule
          </button>
        )}
      </div>

      {/* How it works info banner */}
      {selectedWidget && rules.length === 0 && !rulesLoading && (
        <div className="bg-violet-50 border border-violet-100 rounded-2xl p-5 mb-6 flex gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <HiDocumentText className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="font-bold text-violet-900 text-sm">No page rules yet</p>
            <p className="text-[12.5px] text-violet-600 mt-1 leading-relaxed">
              Page rules let you configure per-page behaviour for the chat widget.<br />
              Add a rule to set <strong>auto-open timing</strong>, a custom <strong>welcome message</strong>,
              or <strong>static AI context</strong> for any specific page on your website.
            </p>
          </div>
        </div>
      )}

      {/* Rules grid */}
      {!selectedWidget ? (
        <EmptyState
          icon={HiGlobeAlt}
          title="Select a widget"
          description="Choose a widget from the dropdown above to manage its page rules."
        />
      ) : rulesLoading ? (
        <LoadingState message="Loading page rules…" />
      ) : rules.length === 0 ? (
        <div className="flex justify-center mt-8">
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-purple text-white text-sm font-semibold shadow-purple"
          >
            <HiPlus className="w-4 h-4" />
            Add your first page rule
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {rules.map(rule => (
            <PageRuleCard
              key={rule.id}
              rule={rule}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRule ? `Edit — ${editingRule.urlPath}` : 'Add Page Rule'}
        size="lg"
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-gradient-purple text-white text-sm font-semibold shadow-purple disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editingRule ? 'Save Changes' : 'Add Rule'}
            </button>
          </>
        }
      >
        <PageRuleForm values={form} onChange={handleField} />
      </Modal>
    </div>
  )
}
