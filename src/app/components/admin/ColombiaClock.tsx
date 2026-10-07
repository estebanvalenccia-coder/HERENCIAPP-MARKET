import { useEffect, useState } from 'react'

/**
 * Small clock that shows the current time in Colombia (America/Bogota).
 * It updates every second to stay accurate.
 */
export default function ColombiaClock() {
  const [time, setTime] = useState('')

  const updateTime = () => {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Bogota',
    })
    setTime(formatter.format(now))
  }

  useEffect(() => {
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className='absolute top-4 right-4 bg-white/70 backdrop-blur-sm px-2 py-1 rounded text-sm font-mono text-emerald-800 shadow'>
      🇨🇴 {time}
    </div>
  )
}
