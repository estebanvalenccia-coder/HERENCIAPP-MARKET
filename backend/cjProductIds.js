// Shared parser used by catalog import, supplier linking and checkout checks.
// CJ product pages may contain a UUID or a decimal product ID.
// Parsing a product link only identifies its claimed PID; all prices, variants and
// shipping still have to be verified with CJ's authenticated read-only APIs.
const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PRODUCT_ID_RE = new RegExp("^(?:" + UUID_PATTERN + "|[0-9]{13,24})$", "i");
const CJ_HOSTS = new Set(["cjdropshipping.com", "www.cjdropshipping.com"]);

export function isCjProductId(value) {
  return PRODUCT_ID_RE.test(String(value || "").trim());
}

export function extractCjProductId(input) {
  try {
    const url = input instanceof URL ? input : new URL(String(input || ""));
    if (url.protocol !== "https:" || url.username || url.password ||
        !CJ_HOSTS.has(url.hostname.toLowerCase())) return "";
    const match = url.pathname.match(/(?:^|\/)[^/]*-p-([0-9a-f-]{13,36})\.html$/i);
    return match && isCjProductId(match[1]) ? match[1] : "";
  } catch {
    return "";
  }
}
