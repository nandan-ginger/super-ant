const variants = {
  purple:  'bg-brand-100 text-brand-700',
  blue:    'bg-blue-100 text-blue-700',
  green:   'bg-emerald-100 text-emerald-700',
  amber:   'bg-amber-100 text-amber-700',
  rose:    'bg-rose-100 text-rose-700',
  gray:    'bg-slate-100 text-slate-600',
  online:  'bg-emerald-100 text-emerald-700',
  offline: 'bg-rose-100 text-rose-700',
}

const sizes = {
  sm: 'text-[10px] px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
}

export function Badge({ variant = 'gray', size = 'md', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold tracking-wide ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </span>
  )
}
