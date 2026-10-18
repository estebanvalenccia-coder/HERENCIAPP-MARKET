/**
 * Parse AliExpress IDs without requesting arbitrary URLs.
 * Supports canonical product URLs, and numeric IDs. Short redirect links
 * require resolution on the user's browser, not on our server (SSRF).
 */
export function parseAliExpressProductId(input) {
  const value = String(input ?? "").trim();
  if (/^\d{8,22}$/.test(value)) return value;
  if (!value || value.length > 2048) return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (!(host === "aliexpress.com" || host.endsWith(".aliexpress.com"))) return null;
  const match = url.pathname.match(/\/(?:item|i)\/(\d{8,22})(?:\.html)?(?:\/|$)/i);
  if (match) return match[1];
  const queryId = url.searchParams.get("productId") || url.searchParams.get("product_id") || url.searchParams.get("itemId");
  return queryId && /^\d{8,22}$/.test(queryId) ? queryId : null;
}
