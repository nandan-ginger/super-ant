export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 gap-3 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-2">
          <Icon className="w-8 h-8 text-slate-400" />
        </div>
      )}
      <p className="text-base font-semibold text-slate-700">{title}</p>
      {description && (
        <p className="text-sm text-slate-500 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
