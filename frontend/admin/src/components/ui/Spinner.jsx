export function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  }
  return (
    <div
      className={`${sizes[size]} rounded-full border-slate-200 border-t-brand-600 animate-spin ${className}`}
    />
  )
}

export function LoadingState({ message = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-400">
      <Spinner size="md" />
      <span className="text-sm">{message}</span>
    </div>
  )
}
