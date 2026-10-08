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
    <div className="text-emerald-800 font-mono text-sm" title="Hora actual de Madrid">
      {time}
    </div>
  );
}
