import { createContext, useContext, useState, useCallback } from 'react'
import { HiCheckCircle, HiXCircle, HiInformationCircle } from 'react-icons/hi2'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error:   (msg) => addToast(msg, 'error'),
    info:    (msg) => addToast(msg, 'info'),
  }

  const icons = {
    success: <HiCheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />,
    error:   <HiXCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />,
    info:    <HiInformationCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />,
  }

  const borders = {
    success: 'border-l-emerald-400',
    error:   'border-l-rose-400',
    info:    'border-l-blue-400',
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 bg-slate-800 text-white px-4 py-3 rounded-xl shadow-modal border-l-4 ${borders[t.type]} animate-slide-up pointer-events-auto max-w-xs`}
          >
            {icons[t.type]}
            <span className="text-sm font-medium leading-snug">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
