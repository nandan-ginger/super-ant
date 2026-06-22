import { useEffect, useRef, useState } from 'react'
import { useCountUp } from '@/hooks/useCountUp'

export function StatCard({ label, value, sub, icon: Icon, gradient }) {
  const displayValue = useCountUp(value)

  return (
    <div
      className={`relative rounded-2xl p-6 flex items-center gap-4 overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 cursor-default ${gradient}`}
    >
      {/* Decorative circle */}
      <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />

      <div className="relative w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
        <Icon className="w-7 h-7 text-white" />
      </div>

      <div className="relative">
        <p className="text-xs font-semibold text-white/75 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-3xl font-extrabold text-white leading-none tracking-tight">
          {displayValue.toLocaleString()}
        </p>
        {sub && <p className="text-xs text-white/65 mt-1.5">{sub}</p>}
      </div>
    </div>
  )
}
