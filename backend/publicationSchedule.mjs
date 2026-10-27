/**
 * Store absolute ISO-8601 instants with a timezone offset or Z.
 * Datetime-local input values must be converted to ISO before saving.
 */
const WITH_TIMEZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function timeOf(input) {
  if (!input) return null;
  if (typeof input !== "string" || !WITH_TIMEZONE.test(input)) return Number.NaN;
  return Date.parse(input);
}

export function isValidPublicationWindow(window) {
  if (!window) return true;
  if (typeof window !== "object" || Array.isArray(window)) return false;
  const start = timeOf(window.startAt);
  const end = timeOf(window.endAt);
  if ((start !== null && !Number.isFinite(start)) || (end !== null && !Number.isFinite(end))) return false;
  return start === null || end === null || start < end;
}

export function isWithinPublicationWindow(window, now = Date.now()) {
  if (!window) return true;
  if (!isValidPublicationWindow(window)) return false;
  const start = timeOf(window.startAt);
  const end = timeOf(window.endAt);
  return (start === null || now >= start) && (end === null || now < end);
}
