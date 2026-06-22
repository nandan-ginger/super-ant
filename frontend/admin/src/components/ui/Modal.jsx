import { useEffect, useRef } from 'react'
import { HiXMark } from 'react-icons/hi2'

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  className = '',
}) {
  const overlayRef = useRef(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handle = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [open, onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const widths = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div
        className={`relative w-full ${widths[size]} max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-modal animate-scale-in ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <HiXMark className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-7 py-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex justify-end gap-3 px-7 pb-6">{footer}</div>
        )}
      </div>
    </div>
  )
}
