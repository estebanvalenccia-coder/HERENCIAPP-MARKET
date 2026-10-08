import { useEffect, useState } from 'react';

/**
 * Returns the current time in Madrid (Europe/Madrid) formatted as HH:mm:ss.
 */
function getMadridTime(): string {
  return new Date().toLocaleTimeString('es-ES', {
    hour12: false,
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function Clock() {
  const [time, setTime] = useState<string>(getMadridTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getMadridTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 font-mono text-sm font-semibold tabular-nums text-emerald-900 shadow-sm" role="timer" aria-label={`Hora de Madrid: ${time}`} title="Hora actual de Madrid"><span className="font-sans text-[11px] font-bold uppercase tracking-wide text-emerald-700">Madrid</span>
      {time}
    </div>
  );
}
