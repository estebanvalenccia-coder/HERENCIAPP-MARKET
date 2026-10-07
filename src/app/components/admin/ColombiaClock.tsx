import { useEffect, useState } from "react";

/**
 * Displays the current time in Colombia (America/Bogota) in 24‑hour format.
 * The time updates every minute.
 */
export default function ColombiaClock() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "America/Bogota",
      }).format(now);
      setTime(formatted);
    };
    updateTime(); // initial call
    const intervalId = setInterval(updateTime, 60_000); // update each minute
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="text-sm font-mono text-emerald-700" title="Hora de Colombia (UTC‑5)">
      {time}
    </div>
  );
}
