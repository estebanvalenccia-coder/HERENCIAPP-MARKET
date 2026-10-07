import { useEffect, useState } from 'react';

/**
 * ColombiaClock
 * -----------
 * Displays the current time in Colombia (America/Bogota) using a 24‑hour format.
 * The component updates every second to stay accurate.
 * It accepts an optional `className` prop so it can be positioned freely by the
 * parent component.
 */
export default function ColombiaClock({ className = '' }: { className?: string }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'America/Bogota',
      });
      setTime(formatter.format(now));
    };
    update(); // initialise immediately
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`text-sm font-mono text-emerald-700 ${className}`} title='Hora de Colombia'>
      {time}
    </div>
  );
}
