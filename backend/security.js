export function securityHeaders() {
  return (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self)");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  };
}

export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 20,
  message = "Demasiadas solicitudes. Inténtalo de nuevo más tarde.",
  keyFn = defaultKey,
} = {}) {
  const hits = new Map();
  let lastCleanup = 0;

  return (req, res, next) => {
    const now = Date.now();
    if (now - lastCleanup > windowMs) {
      lastCleanup = now;
      for (const [key, entry] of hits.entries()) {
        if (entry.resetAt <= now) hits.delete(key);
      }
    }

    const key = String(keyFn(req) || "anonymous");
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      return res.status(429).json({ error: message });
    }

    next();
  };
}

export function requireTrustedBrowserRequest(isAllowedOrigin) {
  return (req, res, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
    if (req.path === "/api/stripe/webhook") return next();

    const origin = String(req.headers.origin || "").trim();
    if (origin && !isAllowedOrigin(origin)) {
      return res.status(403).json({ error: "Origen no permitido" });
    }

    const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
    if (fetchSite === "cross-site") {
      return res.status(403).json({ error: "Solicitud cross-site bloqueada" });
    }

    next();
  };
}

function defaultKey(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "anonymous";
}
