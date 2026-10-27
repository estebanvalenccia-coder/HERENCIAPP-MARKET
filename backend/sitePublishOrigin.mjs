/**
 * CSRF origin check for the versioned site publication endpoint.
 *
 * The public storefront passes through a Railway frontend proxy and a Railway
 * backend proxy. Railway may rewrite x-forwarded-host to the backend service
 * hostname on the second hop. In that case, accept the explicitly trusted
 * storefront origins, not arbitrary user-supplied domains.
 */
const PUBLIC_STOREFRONT_ORIGINS = [
  "https://www.herenciamarket.es",
  "https://herenciamarket.es",
];

function originOf(value) {
  try {
    const url = new URL(String(value || ""));
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash) return "";
    return url.origin.toLowerCase();
  } catch {
    return "";
  }
}

export function isTrustedSitePublishOrigin(headers, configuredOrigins = "") {
  if (String(headers?.["sec-fetch-site"] || "").toLowerCase() === "cross-site") return false;
  const origin = String(headers?.origin || "").trim();
  if (!origin) return true; // Existing non-browser, cookie-authenticated clients.
  const normalized = originOf(origin);
  if (!normalized) return false;

  const trusted = new Set(PUBLIC_STOREFRONT_ORIGINS);
  for (const entry of String(configuredOrigins || "").split(",")) {
    const parsed = originOf(entry.trim());
    if (parsed && parsed.startsWith("https://")) trusted.add(parsed);
  }
  if (trusted.has(normalized)) return true;

  // Preserve legitimate same-origin preview/development installations.
  // This is permitted only when the forwarded host matches the actual
  // browser origin and Fetch Metadata does not say cross-site.
  const forwardedHost = String(headers?.["x-forwarded-host"] || headers?.host || "")
    .split(",")[0].trim().toLowerCase();
  try {
    const supplied = new URL(normalized);
    return supplied.host === forwardedHost;
  } catch {
    return false;
  }
}
