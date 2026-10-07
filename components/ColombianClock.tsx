import React, { useEffect, useState } from 'react';
import '../styles/clock.css';

/**
 * ColombianClock
 * ------------
 * Renders the current time in Colombia (America/Bogota) using a 24‑hour format.
 * The clock updates every second and is positioned in the top‑left corner of the viewport.
 */
const ColombianClock: React.FC = () => {
  const [time, setTime] = useState<string>('');

  // Formatter for Colombian time (UTC‑5) in 24‑hour format
  const formatter = new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/Bogota',
  });

  useEffect(() => {
    const update = () => setTime(formatter.format(new Date()));
    update(); // initialise immediately
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="colombian-clock" aria-label="Hora de Colombia">
      {time}
    </div>
  );
};

export default ColombianClock;
