/**
 * Publication windows are stored as ISO-8601 instants (with timezone offset or Z).
 * Never rely on the visitor's local clock interpretation of a timezone-less string.
 */
export function isWithinPublicationWindow(window, now = Date.now()) {
  if (!window || typeof window !== "object") return true;
  const { startAt, endAt } = window;
  const start = startAt ? Date.parse(startAt) : null;
  const end = endAt ? Date.parse(endAt) : null;
  if ((startAt && !Number.isFinite(start)) || (endAt && !Number.isFinite(end))) return false;
  if (start !== null && end !== null && start > end) return false;
  return (start === null || now >= start) && (end === null || now < end);
}
