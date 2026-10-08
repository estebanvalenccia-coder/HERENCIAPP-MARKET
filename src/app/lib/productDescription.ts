/** Presents supplier HTML as inert readable text; remote HTML is never injected into React. */
export function cleanProductDescription(input: unknown, maxLength = 5000): string {
  const source = String(input ?? "").slice(0, 60000);
  return source
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|iframe|object|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<\s*li\b[^>]*>/gi, "\n• ")
    .replace(/<\s*(br|hr)\b[^>]*\/?\s*>/gi, "\n")
    .replace(/<\s*\/(p|div|section|article|ul|ol|h[1-6]|tr|li)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|amp|nbsp|lt|gt|quot|apos|hellip|bull);/gi, (_match, entity: string) => {
      const value = entity.toLowerCase();
      const named: Record<string, string> = { amp: "&", nbsp: " ", lt: "<", gt: ">", quot: '"', apos: "'", hellip: "…", bull: "•" };
      if (value in named) return named[value];
      const cp = value.startsWith("#x") ? parseInt(value.slice(2), 16) : parseInt(value.slice(1), 10);
      return Number.isInteger(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : " ";
    })
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, Math.max(0, Math.min(5000, Number(maxLength) || 5000)));
}
