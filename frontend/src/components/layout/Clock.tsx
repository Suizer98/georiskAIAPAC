import { useEffect, useState } from 'react'

export default function Clock() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const hours = time.getHours().toString().padStart(2, '0')
  const minutes = time.getMinutes().toString().padStart(2, '0')
  const seconds = time.getSeconds().toString().padStart(2, '0')
  const dateStr = time.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="flex flex-col items-end text-right">
      <div className="flex items-baseline gap-1 font-mono">
        <span className="text-lg font-semibold text-white">{hours}</span>
        <span className="text-sm text-slate-400">:</span>
        <span className="text-lg font-semibold text-white">{minutes}</span>
        <span className="text-sm text-slate-400">:</span>
        <span className="text-sm font-medium text-slate-300">{seconds}</span>
      </div>
      <div className="text-xs text-slate-400">{dateStr}</div>
    </div>
  )
}
