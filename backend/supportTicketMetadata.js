export const SUPPORT_PRIORITIES = Object.freeze(["low", "normal", "high", "urgent"]);
export const SUPPORT_CATEGORIES = Object.freeze(["general", "orders", "delivery", "refunds", "products", "services", "other"]);

/** Only administrators can use these fields, and only through authenticated support endpoints. */
export function parseSupportTicketMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Metadatos no válidos");
  const result = {};
  if (Object.prototype.hasOwnProperty.call(value, "priority")) {
    if (!SUPPORT_PRIORITIES.includes(value.priority)) throw new Error("Prioridad no válida");
    result.priority = value.priority;
  }
  if (Object.prototype.hasOwnProperty.call(value, "category")) {
    if (!SUPPORT_CATEGORIES.includes(value.category)) throw new Error("Categoría no válida");
    result.category = value.category;
  }
  if (!Object.keys(result).length) throw new Error("No hay cambios válidos");
  return result;
}
