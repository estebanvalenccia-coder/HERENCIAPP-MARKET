import { useEffect, useState } from "react";

export default function ClockMadrid() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const madridTime = new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Europe/Madrid",
  }).format(time);

  return (
    <div className="text-sm text-muted-foreground px-4 py-2 bg-muted/20 rounded-md mr-4">
      <span className="font-mono">{madridTime}</span> (Madrid)
    </div>
  );
}
