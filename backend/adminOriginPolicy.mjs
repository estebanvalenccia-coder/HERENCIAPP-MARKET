/**
 * Browsers send the shop origin, but Vercel rewrites /api requests to Railway.
 * Railway's host/x-forwarded-host therefore cannot be used as the sole CSRF
 * comparison: herenciamarket.es !== herenciapp-market-production.up.railway.app.
 *
 * Only established first-party storefronts or explicitly configured origins
 * may publish with a cookie-authenticated session. A matching spoofable Host
 * header by itself is NEVER sufficient to authorize a publication.
 */
const PRODUCTION_ORIGINS = new Set([
  "https://herenciamarket.es",
  "https://www.herenciamarket.es",
]);

const VERCEL_PREVIEW_HOST = /^herenciapp-market-[a-z0-9-]+-daniels-projects-b54d9ed6\.vercel\.app$/;

function normalizedOrigin(value) {
  try {
    if (typeof value !== "string" || !value.trim()) return null;
    const url = new URL(value.trim());
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

export function trustedAdminPublicationOrigins(env = process.env) {
  const allowed = new Set(PRODUCTION_ORIGINS);
  for (const variable of ["FRONTEND_URL", "CORS_ORIGIN", "ADMIN_PUBLIC_ORIGINS"]) {
    const entry = String(env?.[variable] || "");
    for (const part of entry.split(/[\s,;]+/)) {
      const origin = normalizedOrigin(part);
      if (!origin) continue;
      // Production admin sessions must never be authorized from http://
      // origins outside of local development.
      if (origin.startsWith("https://")) allowed.add(origin);
    }
  }
  if (env?.NODE_ENV !== "production") {
    for (const hostname of ["localhost", "127.0.0.1"]) {
      for (const port of ["3000", "3001", "5173", "4173"]) {
        allowed.add(`http://${hostname}:${port}`);
      }
    }
  }
  return allowed;
}

export function isAllowedAdminPublicationOrigin(headers = {}, env = process.env) {
  const fetchSite = String(headers["sec-fetch-site"] || "").toLowerCase().trim();
  if (fetchSite === "cross-site") return false;
  const origin = normalizedOrigin(headers.origin);
  if (!origin) return false; // Cookie-authenticated writes require an Origin.
  if (trustedAdminPublicationOrigins(env).has(origin)) return true;
  if (origin.startsWith("https://")) {
    const host = new URL(origin).hostname.toLowerCase();
    if (VERCEL_PREVIEW_HOST.test(host)) return true;
  }
  return false;
}
