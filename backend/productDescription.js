// Convert supplier HTML into safe, readable plain text without rendering remote markup.
export function cleanSupplierDescription(input, maxLength = 5000) {
  const source = String(input ?? "").slice(0, 60000);
  const text = source
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|iframe|object|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<\s*li\b[^>]*>/gi, "\n• ")
    .replace(/<\s*(br|hr)\b[^>]*\/?\s*>/gi, "\n")
    .replace(/<\s*\/(p|div|section|article|ul|ol|h[1-6]|tr|li)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|amp|nbsp|lt|gt|quot|apos|hellip|bull);/gi, (_match, entity) => {
      const value = String(entity).toLowerCase();
      const named = { amp: "&", nbsp: " ", lt: "<", gt: ">", quot: '"', apos: "'", hellip: "…", bull: "•" };
      if (value in named) return named[value];
      const cp = value.startsWith("#x") ? parseInt(value.slice(2), 16) : parseInt(value.slice(1), 10);
      return Number.isInteger(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : " ";
    })
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.slice(0, Math.max(0, Math.min(5000, Number(maxLength) || 5000)));
}
