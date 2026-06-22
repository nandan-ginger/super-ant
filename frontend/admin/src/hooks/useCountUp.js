import { useState, useEffect, useRef } from 'react'

export function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0)
  const startTime = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    if (target === undefined || target === null) return
    const num = Number(target) || 0
    if (num === 0) { setValue(0); return }

    startTime.current = null
    const step = (now) => {
      if (!startTime.current) startTime.current = now
      const elapsed = now - startTime.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.floor(eased * num))
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
      else setValue(num)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return value
}
