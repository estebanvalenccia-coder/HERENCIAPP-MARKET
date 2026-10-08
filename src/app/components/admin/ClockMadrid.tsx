import { useEffect, useState } from 'react';

/**
 * ClockMadrid displays the current time in Madrid (Europe/Madrid timezone).
 * It updates every second.
 */
export default function ClockMadrid() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const madridTime = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Europe/Madrid',
  }).format(time);

  return (
    <div className='mb-4 rounded-full bg-emerald-100 px-4 py-2 text-sm font-mono font-black text-emerald-800 shadow-inner'>
      🕒 {madridTime} (Madrid)
    </div>
  );
}
