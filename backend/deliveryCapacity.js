export const DELIVERY_SLOTS = [
  "09:00-12:00",
  "12:00-15:00",
  "15:00-18:00",
  "18:00-21:00",
];

function madridParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(now).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour || 0),
  };
}

export function deliveryRules(settings = {}) {
  const capacity = Math.max(1, Math.floor(Number(settings.deliverySlotCapacity || 6)));
  const cutoffHour = Math.min(23, Math.max(0, Math.floor(Number(settings.sameDayCutoffHour ?? 14))));
  const closedWeekdays = Array.isArray(settings.deliveryClosedWeekdays)
    ? settings.deliveryClosedWeekdays.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : [0];

  return {
    capacity,
    cutoffHour,
    closedWeekdays: [...new Set(closedWeekdays)],
    enabled: settings.scheduledOrdersEnabled !== false,
  };
}

export function validateDeliverySchedule({ requestedDate, requestedTimeSlot, settings = {}, now = new Date() }) {
  const date = String(requestedDate || "").trim();
  const slot = String(requestedTimeSlot || "").trim();
  const rules = deliveryRules(settings);

  if (!date) return { ok: true, requestedDate: "", requestedTimeSlot: "", rules };
  if (!rules.enabled) {
    const error = new Error("Los pedidos programados están desactivados temporalmente.");
    error.statusCode = 409;
    throw error;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const error = new Error("La fecha de entrega no es válida.");
    error.statusCode = 400;
    throw error;
  }
  if (slot && !DELIVERY_SLOTS.includes(slot)) {
    const error = new Error("La franja horaria no es válida.");
    error.statusCode = 400;
    throw error;
  }

  const current = madridParts(now);
  if (date < current.date) {
    const error = new Error("No se puede pedir una entrega en una fecha pasada.");
    error.statusCode = 409;
    throw error;
  }

  const weekday = new Date(`${date}T12:00:00+02:00`).getUTCDay();
  if (rules.closedWeekdays.includes(weekday)) {
    const error = new Error("No hay reparto disponible en la fecha seleccionada.");
    error.statusCode = 409;
    throw error;
  }

  if (date === current.date && current.hour >= rules.cutoffHour) {
    const error = new Error(`El reparto para hoy cierra a las ${String(rules.cutoffHour).padStart(2, "0")}:00. Elige otro día.`);
    error.statusCode = 409;
    throw error;
  }

  return { ok: true, requestedDate: date, requestedTimeSlot: slot, rules };
}
