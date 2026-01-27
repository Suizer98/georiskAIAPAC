import { useEffect, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'

type Timezone = {
  id: string
  label: string
  tz: string
}

const APAC_TIMEZONES: Timezone[] = [
  { id: 'SGT', label: 'Singapore (SGT)', tz: 'Asia/Singapore' },
  { id: 'JST', label: 'Tokyo (JST)', tz: 'Asia/Tokyo' },
  { id: 'KST', label: 'Seoul (KST)', tz: 'Asia/Seoul' },
  { id: 'CST', label: 'Beijing (CST)', tz: 'Asia/Shanghai' },
  { id: 'HKT', label: 'Hong Kong (HKT)', tz: 'Asia/Hong_Kong' },
  { id: 'IST', label: 'New Delhi (IST)', tz: 'Asia/Kolkata' },
  { id: 'WIB', label: 'Jakarta (WIB)', tz: 'Asia/Jakarta' },
  { id: 'PHT', label: 'Manila (PHT)', tz: 'Asia/Manila' },
  { id: 'BKK', label: 'Bangkok (ICT)', tz: 'Asia/Bangkok' },
  { id: 'SGT', label: 'Kuala Lumpur (MYT)', tz: 'Asia/Kuala_Lumpur' },
  { id: 'AEST', label: 'Sydney (AEST)', tz: 'Australia/Sydney' },
  { id: 'NZST', label: 'Auckland (NZST)', tz: 'Pacific/Auckland' },
  { id: 'HST', label: 'Hanoi (ICT)', tz: 'Asia/Ho_Chi_Minh' },
  { id: 'TST', label: 'Taipei (TST)', tz: 'Asia/Taipei' },
]

const DEFAULT_TIMEZONE = 'Asia/Singapore'

export default function Clock() {
  const [timezone, setTimezone] = useState<string>(() => {
    return localStorage.getItem('clock-timezone') || DEFAULT_TIMEZONE
  })
  const [time, setTime] = useState(new Date())
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    localStorage.setItem('clock-timezone', timezone)
  }, [timezone])

  const formatTime = (date: Date, tz: string) => {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date)
  }

  const formatDate = (date: Date, tz: string) => {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(date)
  }

  const getTimezoneLabel = (tz: string) => {
    return APAC_TIMEZONES.find((tzObj) => tzObj.tz === tz)?.label || 'SGT'
  }

  const timeStr = formatTime(time, timezone)
  const [hours, minutes, seconds] = timeStr.split(':')
  const dateStr = formatDate(time, timezone)
  const currentTzLabel = getTimezoneLabel(timezone)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex flex-col items-end text-right cursor-pointer hover:opacity-80 transition-opacity"
        >
          <div className="flex items-baseline gap-1 font-mono">
            <span className="text-lg font-semibold text-white">{hours}</span>
            <span className="text-sm text-slate-400">:</span>
            <span className="text-lg font-semibold text-white">{minutes}</span>
            <span className="text-sm text-slate-400">:</span>
            <span className="text-sm font-medium text-slate-300">{seconds}</span>
          </div>
          <div className="text-xs text-slate-400">{dateStr}</div>
          <div className="text-xs text-slate-500 mt-0.5">{currentTzLabel}</div>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={8}
          className="z-50 min-w-[200px] max-w-xs rounded-lg border border-white/10 bg-slate-900/95 p-2 text-white shadow-xl backdrop-blur-md"
        >
          <div className="text-xs font-medium text-slate-400 px-2 py-1.5 mb-1">
            Select Timezone
          </div>
          <div className="max-h-64 overflow-y-auto">
            {APAC_TIMEZONES.map((tz) => (
              <button
                key={tz.id}
                type="button"
                onClick={() => {
                  setTimezone(tz.tz)
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition ${
                  timezone === tz.tz
                    ? 'bg-indigo-500/20 text-indigo-100'
                    : 'hover:bg-white/10 text-white'
                }`}
              >
                {tz.label}
              </button>
            ))}
          </div>
          <Popover.Arrow className="fill-slate-900/95" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
