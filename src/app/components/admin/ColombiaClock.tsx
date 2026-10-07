import { useState, useEffect } from 'react';

/**
 * ColombiaClock displays the current time in Colombia (America/Bogota) in 24‑hour format.
 * It updates every minute.
 */
export default function ColombiaClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/Bogota',
      });
      setTime(formatter.format(now));
    };

    updateTime(); // initial call
    const interval = setInterval(updateTime, 60_000); // update each minute
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="text-sm font-mono text-emerald-700" title="Hora de Colombia (America/Bogota)">
      {time}
    </span>
  );
}
