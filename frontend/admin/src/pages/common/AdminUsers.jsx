import { useState, useEffect } from 'react'
import { HiPlus, HiUsers, HiShieldCheck } from 'react-icons/hi2'
import { HiChatBubbleLeftRight } from 'react-icons/hi2'
import { auth } from '@/api/common/auth'
import { Modal } from '@/components/ui/Modal'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import { fmtDate, getInitials } from '@/utils/format'

// ── Product-Grouped Permissions ───────────────────────────────────────────────
// To add a new product: append an entry to PRODUCT_PERMS with its sections.
const PRODUCT_PERMS = [
  {
    product: 'chatbot',
    label: 'Chatbot',
    icon: HiChatBubbleLeftRight,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-100',
    sections: [
      { key: 'widgets',   label: 'Widgets',    actions: ['view', 'edit', 'delete'] },
      { key: 'livechats', label: 'Live Chats', actions: ['view'] },
      { key: 'visitors',  label: 'Visitors',   actions: ['view'] },
      { key: 'leads',     label: 'Leads',      actions: ['view'] },
    ],
  },
  // Future: add more products here, e.g.:
  // {
  //   product: 'crm',
  //   label: 'CRM',
  //   icon: HiUsers,
  //   color: 'text-cyan-600',
  //   bg: 'bg-cyan-50',
  //   border: 'border-cyan-100',
  //   sections: [
  //     { key: 'contacts', label: 'Contacts', actions: ['view', 'edit', 'delete'] },
  //   ],
  // },
]

// Flat default permissions object built from the PRODUCT_PERMS registry
const DEFAULT_PERMS = PRODUCT_PERMS.reduce((acc, p) => {
  p.sections.forEach(s => {
    acc[s.key] = Object.fromEntries(s.actions.map(a => [a, false]))
  })
  return acc
}, {})

function PermissionsGrid({ perms, onChange }) {
  return (
    <div className="space-y-5 mt-2">
      {PRODUCT_PERMS.map(p => {
        const Icon = p.icon
        return (
          <div key={p.product} className={`rounded-xl border ${p.border} overflow-hidden`}>
            {/* Product header */}
            <div className={`flex items-center gap-2 px-4 py-2.5 ${p.bg} border-b ${p.border}`}>
              <Icon className={`w-3.5 h-3.5 ${p.color}`} />
              <span className={`text-[11px] font-bold uppercase tracking-wider ${p.color}`}>
                {p.label}
              </span>
            </div>
            {/* Sections grid */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-white">
              {p.sections.map(s => (
                <div key={s.key} className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">{s.label}</p>
                  <div className="space-y-2">
                    {s.actions.map(a => (
                      <div key={a} className="flex items-center justify-between">
                        <span className="text-[12.5px] font-medium text-slate-700 capitalize">{a}</span>
                        <ToggleSwitch
                          id={`perm-${s.key}-${a}`}
                          checked={!!perms?.[s.key]?.[a]}
                          onChange={(v) => onChange(s.key, a, v)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function getPermSummary(perms, role) {
  if (role === 'superadmin') return 'All permissions'
  if (!perms) return 'None'
  const granted = PRODUCT_PERMS.flatMap(p =>
    p.sections.filter(s => perms[s.key]?.view).map(s => s.label)
  )
  return granted.length ? granted.join(', ') : 'None'
}



function CreateUserForm({ form, setForm }) {
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setPerm  = (section, action, value) =>
    setForm(f => ({
      ...f,
      permissions: {
        ...f.permissions,
        [section]: { ...f.permissions[section], [action]: value },
      },
    }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Username *</label>
          <input
            type="text" required placeholder="jane_admin"
            value={form.username} onChange={e => setField('username', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Email *</label>
          <input
            type="email" required placeholder="jane@example.com"
            value={form.email} onChange={e => setField('email', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Password *</label>
        <input
          type="password" required placeholder="Min 8 characters"
          value={form.password} onChange={e => setField('password', e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
        />
      </div>
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Permissions</p>
        <PermissionsGrid perms={form.permissions} onChange={setPerm} />
      </div>
    </div>
  )
}

// ── Admin Users Page ──────────────────────────────────────────────────────────
const DEFAULT_FORM = {
  username: '', email: '', password: '',
  permissions: DEFAULT_PERMS,
}

export default function AdminUsers() {
  const toast = useToast()
  const { admin: currentAdmin } = useAuth()

  const [users,     setUsers]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [form,       setForm]       = useState(DEFAULT_FORM)

  const [editPermsOpen, setEditPermsOpen] = useState(false)
  const [editTarget,    setEditTarget]    = useState(null)
  const [editPerms,     setEditPerms]     = useState(DEFAULT_PERMS)

  const load = async () => {
    setLoading(true)
    try {
      const data = await auth.listUsers()
      setUsers(data.users || [])
    } catch (err) {
      toast.error('Failed to load users: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.username || !form.email || !form.password) { toast.error('All fields required.'); return }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters.'); return }
    setSaving(true)
    try {
      await auth.createUser({ username: form.username, email: form.email, password: form.password, permissions: form.permissions })
      toast.success(`Admin "${form.username}" created!`)
      setCreateOpen(false)
      setForm(DEFAULT_FORM)
      load()
    } catch (err) {
      toast.error('Failed to create user: ' + err.message)
    } finally { setSaving(false) }
  }

  const openEditPerms = (user) => {
    setEditTarget(user)
    setEditPerms(user.permissions || DEFAULT_PERMS)
    setEditPermsOpen(true)
  }

  const handleSavePerms = async () => {
    setSaving(true)
    try {
      await auth.updatePermissions(editTarget.id, editPerms)
      toast.success('Permissions updated!')
      setEditPermsOpen(false)
      load()
    } catch (err) {
      toast.error('Failed to update permissions: ' + err.message)
    } finally { setSaving(false) }
  }

  const handleToggleStatus = async (user) => {
    try {
      await auth.setStatus(user.id, !user.is_active)
      toast.success(`User ${!user.is_active ? 'enabled' : 'disabled'}.`)
      load()
    } catch (err) {
      toast.error('Failed to update status: ' + err.message)
    }
  }

  const setEditPerm = (section, action, value) =>
    setEditPerms(p => ({ ...p, [section]: { ...p[section], [action]: value } }))

  return (
    <div>
      <div className="flex justify-end mb-6">
        <button
          onClick={() => { setForm(DEFAULT_FORM); setCreateOpen(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-purple text-white text-sm font-semibold shadow-purple hover:shadow-purple-lg transition-all hover:-translate-y-0.5"
        >
          <HiPlus className="w-4 h-4" />
          Create Admin
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50">
                {['User', 'Role', 'Status', 'Permissions', 'Created', 'Actions'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}><LoadingState /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6}><EmptyState icon={HiUsers} title="No admin users" /></td></tr>
              ) : users.map(u => {
                const isSelf = u.id === currentAdmin?.id
                return (
                  <tr key={u.id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-purple flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {getInitials(u.username)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 flex items-center gap-2">
                            {u.username}
                            {isSelf && <Badge variant="blue" size="sm">You</Badge>}
                          </p>
                          <p className="text-[11.5px] text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={u.role === 'superadmin' ? 'purple' : 'blue'}>
                        {u.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={u.is_active ? 'green' : 'rose'}>
                        {u.is_active ? 'Active' : 'Disabled'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-[12px] text-slate-500 max-w-[180px]">
                      {getPermSummary(u.permissions, u.role)}
                    </td>
                    <td className="px-5 py-4 text-slate-400 whitespace-nowrap">{fmtDate(u.created_at)}</td>
                    <td className="px-5 py-4">
                      {u.role !== 'superadmin' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditPerms(u)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors"
                          >
                            <HiShieldCheck className="w-3.5 h-3.5" />
                            Permissions
                          </button>
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              u.is_active
                                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100'
                                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100'
                            }`}
                          >
                            {u.is_active ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Admin User"
        size="lg"
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
              Create User
            </button>
          </>
        }
      >
        <CreateUserForm form={form} setForm={setForm} />
      </Modal>

      {/* Edit Permissions Modal */}
      <Modal
        open={editPermsOpen}
        onClose={() => setEditPermsOpen(false)}
        title="Edit Permissions"
        size="lg"
        footer={
          <>
            <button onClick={() => setEditPermsOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSavePerms}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-gradient-purple text-white text-sm font-semibold shadow-purple disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Save Permissions
            </button>
          </>
        }
      >
        {editTarget && (
          <>
            <div className="flex items-center gap-3 mb-5 p-3.5 bg-slate-50 rounded-xl">
              <div className="w-9 h-9 rounded-full bg-gradient-purple flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {getInitials(editTarget.username)}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">{editTarget.username}</p>
                <p className="text-xs text-slate-400">{editTarget.email}</p>
              </div>
            </div>
            <PermissionsGrid perms={editPerms} onChange={setEditPerm} />
          </>
        )}
      </Modal>
    </div>
  )
}
