import { useState, useEffect, useRef } from 'react'
import { HiMagnifyingGlass, HiChatBubbleLeftRight, HiUser, HiCpuChip } from 'react-icons/hi2'
import { livechats } from '@/api/client'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { useToast } from '@/context/ToastContext'
import { useWidgets } from '@/hooks/useWidgets'
import { fmtDate, fmtRelative, fmtTime, getInitials } from '@/utils/format'

const LIMIT = 25

// ── Session Item ──────────────────────────────────────────────────────────────
function SessionItem({ session, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 px-4 py-3.5 border-b border-slate-100 hover:bg-slate-50 transition-colors ${active ? 'bg-brand-50 border-l-2 border-l-brand-500' : ''
        }`}
    >
      <div className="w-9 h-9 rounded-full bg-gradient-purple flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        {getInitials(session.display_name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[13px] font-semibold truncate ${active ? 'text-brand-700' : 'text-slate-700'}`}>
            {session.display_name}
          </span>
          {session.has_lead && <Badge variant="green" size="sm">Lead</Badge>}
        </div>
        <p className="text-[11.5px] text-slate-400 mt-0.5">
          {session.message_count} msgs · {fmtRelative(session.last_active)}
        </p>
        {session.page_title && (
          <p className="text-[11px] text-slate-400 truncate mt-0.5">{session.page_title}</p>
        )}
      </div>
    </button>
  )
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] px-4 py-3 rounded-2xl ${isUser ? 'msg-user rounded-br' : 'msg-assistant rounded-bl'}`}>
        <div className={`flex items-center gap-1.5 mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide ${isUser ? 'text-white/65' : 'text-slate-400'}`}>
          {isUser ? <HiUser className="w-3 h-3" /> : <HiCpuChip className="w-3 h-3" />}
          {isUser ? 'Visitor' : 'Assistant'}
        </div>
        <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
        {message.created_at && (
          <p className={`text-[10px] mt-1.5 ${isUser ? 'text-white/50' : 'text-slate-400'} text-right`}>
            {fmtTime(message.created_at)}
          </p>
        )}
      </div>
    </div>
  )
}

// ── LiveChats Page ────────────────────────────────────────────────────────────
export default function LiveChats() {
  const toast = useToast()
  const { widgets, loading: widgetsLoading } = useWidgets()

  const [widgetCode, setWidgetCode] = useState('')
  const [sessions, setSessions] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [sessLoading, setSessLoading] = useState(false)
  const [query, setQuery] = useState('')

  const [activeSession, setActiveSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [msgsLoading, setMsgsLoading] = useState(false)

  const messagesEndRef = useRef(null)

  // Load sessions when widget or offset changes
  useEffect(() => {
    if (!widgetCode) return
    setSessLoading(true)
    setActiveSession(null)
    setMessages([])
    livechats.sessions(widgetCode, { limit: LIMIT, offset })
      .then(d => {
        setSessions(d.sessions || [])
        setTotal(d.total || 0)
      })
      .catch(err => toast.error('Failed to load sessions: ' + err.message))
      .finally(() => setSessLoading(false))
  }, [widgetCode, offset])

  // Scroll to bottom when messages load
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const openSession = async (session) => {
    setActiveSession(session)
    setMsgsLoading(true)
    setMessages([])
    try {
      const data = await livechats.messages(session.id)
      setMessages(data.messages || [])
    } catch (err) {
      toast.error('Failed to load messages: ' + err.message)
    } finally {
      setMsgsLoading(false)
    }
  }

  const filtered = query
    ? sessions.filter(s => s.display_name.toLowerCase().includes(query.toLowerCase()))
    : sessions

  return (
    <div className="flex flex-col h-[calc(100vh-130px)]">
      {/* Widget Selector */}
      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm font-semibold text-slate-500 whitespace-nowrap">Widget:</label>
        <select
          value={widgetCode}
          onChange={e => { setWidgetCode(e.target.value); setOffset(0); setQuery('') }}
          className="min-w-[220px] px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
        >
          <option value=""> -- Select a widget -- </option>
          {widgets.map(w => (
            <option key={w.widget_code} value={w.widget_code}>{w.name}</option>
          ))}
        </select>
        {widgetCode && total > 0 && (
          <span className="text-sm text-slate-400">{total} conversation{total !== 1 ? 's' : ''}</span>
        )}
      </div>

      {!widgetCode ? (
        <EmptyState
          icon={HiChatBubbleLeftRight}
          title="Select a widget to view chats"
          description="Choose a widget from the dropdown above to browse live chat conversations."
        />
      ) : (
        <div className="flex-1 grid grid-cols-[340px_1fr] gap-4 min-h-0">
          {/* Sessions Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 space-y-3">
              <p className="text-sm font-bold text-slate-700">Conversations</p>
              <div className="relative">
                <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search visitors…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {sessLoading ? (
                <LoadingState message="Loading sessions…" />
              ) : filtered.length === 0 ? (
                <EmptyState icon={HiChatBubbleLeftRight} title="No conversations" />
              ) : filtered.map(s => (
                <SessionItem
                  key={s.id}
                  session={s}
                  active={activeSession?.id === s.id}
                  onClick={() => openSession(s)}
                />
              ))}
            </div>

            <Pagination
              total={total}
              limit={LIMIT}
              offset={offset}
              onPageChange={setOffset}
            />
          </div>

          {/* Conversation Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
            {!activeSession ? (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState
                  icon={HiChatBubbleLeftRight}
                  title="Select a conversation"
                  description="Click a session on the left to view its messages"
                />
              </div>
            ) : (
              <>
                {/* Conversation Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                  <div className="w-9 h-9 rounded-full bg-gradient-purple flex items-center justify-center text-white text-xs font-bold">
                    {getInitials(activeSession.display_name)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{activeSession.display_name}</p>
                    <p className="text-xs text-slate-400">
                      {messages.length} messages · Last active {fmtRelative(activeSession.last_active)}
                    </p>
                  </div>
                  {activeSession.has_lead && <Badge variant="green" className="ml-auto">Lead</Badge>}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {msgsLoading ? (
                    <LoadingState message="Loading messages…" />
                  ) : messages.length === 0 ? (
                    <EmptyState icon={HiChatBubbleLeftRight} title="No messages" description="This session has no recorded messages." />
                  ) : (
                    <>
                      {messages.map((m, i) => (
                        <MessageBubble key={i} message={m} />
                      ))}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
