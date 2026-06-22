import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2'

export function Pagination({ total, limit, offset, onPageChange }) {
  const from  = Math.min(offset + 1, total)
  const to    = Math.min(offset + limit, total)
  const hasPrev = offset > 0
  const hasNext = offset + limit < total

  if (total <= limit) return null

  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100">
      <span className="text-sm text-slate-500">
        {total === 0 ? 'No results' : `Showing ${from}–${to} of ${total.toLocaleString()}`}
      </span>
      <div className="flex gap-2">
        <button
          disabled={!hasPrev}
          onClick={() => onPageChange(offset - limit)}
          className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-slate-200 disabled:hover:text-slate-500"
        >
          <HiChevronLeft className="w-4 h-4" />
        </button>
        <button
          disabled={!hasNext}
          onClick={() => onPageChange(offset + limit)}
          className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-slate-200 disabled:hover:text-slate-500"
        >
          <HiChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
