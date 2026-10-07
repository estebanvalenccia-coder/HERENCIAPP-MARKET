import { useState, useEffect } from 'react';

function getColombiaTime(): string {
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/Bogota',
  }).format(new Date());
}

export default function ColombiaClock() {
  const [time, setTime] = useState<string>(getColombiaTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getColombiaTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-sm font-medium text-emerald-700 flex items-center gap-1">
      <span role="img" aria-label="clock">🕒</span>
      {time}
    </div>
  );
}
