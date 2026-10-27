import assert from "node:assert/strict";
import test from "node:test";
import { isTrustedSitePublishOrigin } from "./sitePublishOrigin.mjs";

test("official www origin survives a Railway backend proxy host rewrite", () => {
  assert.equal(isTrustedSitePublishOrigin({
    origin: "https://www.herenciamarket.es",
    host: "herenciapp-market-production.up.railway.app",
    "x-forwarded-host": "herenciapp-market-production.up.railway.app",
    "sec-fetch-site": "same-origin",
  }), true);
  assert.equal(isTrustedSitePublishOrigin({
    origin: "https://herenciamarket.es",
    "x-forwarded-host": "herenciapp-market-production.up.railway.app",
    "sec-fetch-site": "same-origin",
  }), true);
});

test("cross-site requests are rejected even when Origin claims an official domain", () => {
  assert.equal(isTrustedSitePublishOrigin({
    origin: "https://www.herenciamarket.es",
    "x-forwarded-host": "www.herenciamarket.es",
    "sec-fetch-site": "cross-site",
  }), false);
});

test("unknown origins cannot publish through a mismatched proxy host", () => {
  assert.equal(isTrustedSitePublishOrigin({
    origin: "https://attacker.example",
    "x-forwarded-host": "herenciapp-market-production.up.railway.app",
    "sec-fetch-site": "same-site",
  }), false);
  assert.equal(isTrustedSitePublishOrigin({ origin: "javascript:alert(1)" }), false);
});

test("same-origin environment hosts and approved HTTPS origins remain valid", () => {
  assert.equal(isTrustedSitePublishOrigin({
    origin: "https://preview.example",
    "x-forwarded-host": "preview.example",
    "sec-fetch-site": "same-origin",
  }), true);
  assert.equal(isTrustedSitePublishOrigin({
    origin: "https://shop.example",
    "x-forwarded-host": "backend.example",
    "sec-fetch-site": "same-origin",
  }, "https://shop.example"), true);
  assert.equal(isTrustedSitePublishOrigin({
    origin: "http://shop.example",
    "x-forwarded-host": "backend.example",
    "sec-fetch-site": "same-origin",
  }, "https://shop.example"), false);
});

test("no browser Origin header retains the existing cookie-authorization flow", () => {
  assert.equal(isTrustedSitePublishOrigin({}), true);
});
