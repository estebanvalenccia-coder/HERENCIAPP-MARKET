import { useEffect, useState } from 'react'

/**
 * Returns the current time in Colombia (America/Bogota) formatted as HH:mm:ss (24‑hour).
 */
function getColombiaTime(): string {
  return new Date().toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/Bogota',
  })
}

/**
 * Small clock component displayed at the top‑right corner of the admin layout.
 */
export default function ColombiaClock() {
  const [time, setTime] = useState<string>(getColombiaTime())

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getColombiaTime())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed top-4 right-4 bg-white/80 backdrop-blur-md rounded-md px-3 py-1 text-sm font-mono text-emerald-800 shadow-md">
      {time}
    </div>
  )
}
