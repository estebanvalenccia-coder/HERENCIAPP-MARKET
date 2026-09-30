import test from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter, requireTrustedBrowserRequest } from "./security.js";

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("rate limiter blocks after max requests", () => {
  const middleware = createRateLimiter({ windowMs: 60_000, max: 2 });
  const req = { headers: { "x-forwarded-for": "1.2.3.4" }, socket: {}, method: "POST", path: "/api/customer/login" };
  let nextCalls = 0;
  const next = () => { nextCalls += 1; };

  const a = response(); middleware(req, a, next);
  const b = response(); middleware(req, b, next);
  const c = response(); middleware(req, c, next);

  assert.equal(nextCalls, 2);
  assert.equal(c.statusCode, 429);
  assert.match(c.body.error, /Demasiadas solicitudes/i);
});

test("trusted-browser middleware blocks cross-site writes", () => {
  const middleware = requireTrustedBrowserRequest((origin) => origin === "https://www.herenciamarket.es");
  const req = { method: "POST", path: "/api/customer/profile", headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" } };
  const res = response();
  let called = false;
  middleware(req, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res.statusCode, 403);
});

test("trusted-browser middleware allows same-origin writes", () => {
  const middleware = requireTrustedBrowserRequest((origin) => origin === "https://www.herenciamarket.es");
  const req = { method: "POST", path: "/api/customer/profile", headers: { origin: "https://www.herenciamarket.es", "sec-fetch-site": "same-origin" } };
  const res = response();
  let called = false;
  middleware(req, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(res.statusCode, 200);
});
