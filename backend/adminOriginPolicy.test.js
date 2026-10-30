import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedAdminPublicationOrigin, trustedAdminPublicationOrigins } from "./adminOriginPolicy.mjs";

const production = { NODE_ENV: "production" };

test("the actual storefront's cookie-authenticated publish request is allowed behind Vercel→Railway", () => {
  for (const origin of ["https://herenciamarket.es", "https://www.herenciamarket.es", "https://tropically.es", "https://www.tropically.es"]) {
    assert.equal(isAllowedAdminPublicationOrigin({
      origin,
      host: "herenciapp-market-production.up.railway.app",
      "x-forwarded-host": "herenciapp-market-production.up.railway.app",
      "sec-fetch-site": "same-origin",
    }, production), true, origin);
  }
});

test("rejects forged forwarded-host, rogue origins and absent Origin", () => {
  for (const origin of [
    "https://herenciamarket.es.evil.example",
    "https://fake-herenciamarket.es",
    "http://herenciamarket.es",
    "https://unknown-project.vercel.app",
    "https://herenciapp-market-evil-project.vercel.app",
    "null",
    "javascript:alert(1)",
  ]) {
    assert.equal(isAllowedAdminPublicationOrigin({
      origin, host: "herenciamarket.es", "x-forwarded-host": new URL("https://herenciamarket.es").host,
      "sec-fetch-site": "same-site",
    }, production), false, origin);
  }
  assert.equal(isAllowedAdminPublicationOrigin({ host: "herenciamarket.es", "sec-fetch-site": "same-origin" }, production), false);
});

test("cross-site browser requests are denied even when Origin seems to be trusted", () => {
  assert.equal(isAllowedAdminPublicationOrigin({
    origin: "https://herenciamarket.es", "sec-fetch-site": "cross-site",
  }, production), false);
});

test("official project previews and explicitly configured https origins can publish", () => {
  assert.equal(isAllowedAdminPublicationOrigin({
    origin: "https://herenciapp-market-xyz123-daniels-projects-b54d9ed6.vercel.app",
    "sec-fetch-site": "same-origin",
  }, production), true);
  assert.equal(isAllowedAdminPublicationOrigin({
    origin: "https://staging.myherencia.com",
    "sec-fetch-site": "same-origin",
  }, { NODE_ENV: "production", FRONTEND_URL: "https://staging.myherencia.com/admin" }), true);
});

test("wildcard and insecure additional origins are ignored in production", () => {
  const hosts = trustedAdminPublicationOrigins({
    NODE_ENV: "production", FRONTEND_URL: "http://evil.example", CORS_ORIGIN: "*",
  });
  assert.equal(hosts.has("http://evil.example"), false);
  assert.equal(hosts.has("*"), false);
  assert.equal(isAllowedAdminPublicationOrigin({ origin: "http://localhost:5173" }, production), false);
  assert.equal(isAllowedAdminPublicationOrigin({ origin: "http://localhost:5173" }, { NODE_ENV: "development" }), true);
});
