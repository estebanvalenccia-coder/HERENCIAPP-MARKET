import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  ALIEXPRESS_OAUTH_KEY, ALIEXPRESS_TRACK_KEY, ALIEXPRESS_SNAPSHOT_PREFIX,
  encryptAliExpressTokens, decryptAliExpressTokens,
  normalizeAliExpressTokenResponse, signAliExpress,
  verifyAliExpressState, createAliExpressConnector,
} from "./aliexpressConnector.js";
import { isPrivateSupplierStorageKey } from "./supplierInternalStorageSecurity.js";

test("signs IOP OP path and sorted fields without transmitting app secret", () => {
  const params = { code: "sample", timestamp: "1700000000000", app_key: "123", sign_method: "sha256" };
  const raw = "/auth/token/create" + Object.keys(params).sort().map((key) => key + params[key]).join("");
  assert.equal(signAliExpress("/auth/token/create", params, "test-secret"), crypto.createHmac("sha256", "test-secret").update(raw).digest("hex").toUpperCase());
  assert.notEqual(signAliExpress("/auth/token/create", params, "test-secret"), signAliExpress("/auth/token/create", params, "different"));
  assert.equal(signAliExpress("aliexpress.ds.product.get", params, "test-secret", true), crypto.createHmac("sha256", "test-secret").update(raw.slice("/auth/token/create".length)).digest("hex").toUpperCase());
});

test("encrypts OAuth tokens using AES-GCM and refuses modified ciphertext", () => {
  const previous = process.env.ALIEXPRESS_TOKEN_ENCRYPTION_KEY;
  process.env.ALIEXPRESS_TOKEN_ENCRYPTION_KEY = "long-secret-from-production-env-at-least-24";
  try {
    const value = { accessToken: "access-secret-example", refreshToken: "refresh-secret-example" };
    const encrypted = encryptAliExpressTokens(value);
    assert.ok(!encrypted.includes(value.accessToken));
    assert.deepEqual(decryptAliExpressTokens(encrypted), value);
    const edited = JSON.parse(encrypted);
    edited.payload = "A" + edited.payload.slice(1);
    assert.throws(() => decryptAliExpressTokens(JSON.stringify(edited)));
  } finally {
    if (previous === undefined) delete process.env.ALIEXPRESS_TOKEN_ENCRYPTION_KEY;
    else process.env.ALIEXPRESS_TOKEN_ENCRYPTION_KEY = previous;
  }
});

test("normalizes token expiry and account metadata without exposing raw provider JSON", () => {
  const now = 1700000000000;
  const token = normalizeAliExpressTokenResponse({
    access_token: "access", refresh_token: "refresh", expires_in: 3600, refresh_expires_in: 7200, account_platform: "buyerApp"
  }, null, now);
  assert.equal(token.accessExpiresAt, now + 3600000);
  assert.equal(token.refreshExpiresAt, now + 7200000);
  assert.equal(token.accountPlatform, "buyerApp");
  assert.throws(() => normalizeAliExpressTokenResponse({ access_token: "", refresh_token: "r" }), /access token/);
});

test("invalid state and missing cookie never authorize", () => {
  assert.equal(verifyAliExpressState("forged", "forged"), false);
  assert.equal(verifyAliExpressState("a.b.c", "a.b.c"), false);
  assert.equal(verifyAliExpressState("faked.1700000000000.fake", null), false);
});

test("private records must be inaccessible through the generic storage API", () => {
  for (const key of [ALIEXPRESS_OAUTH_KEY, ALIEXPRESS_TRACK_KEY, ALIEXPRESS_SNAPSHOT_PREFIX + "1005000123456789"]) {
    assert.equal(isPrivateSupplierStorageKey(key), true);
  }
});

test("admin authorization is mandatory and cannot reveal saved tokens", async () => {
  let saved = false;
  const connector = createAliExpressConnector({
    read: async () => { saved = true; return "secret"; },
    write: async () => { throw new Error("no writes"); },
    requireAdmin: async () => false,
  });
  const recorded = {};
  const res = {
    writeHead(status, headers) { recorded.status = status; recorded.headers = headers; },
    end(body) { recorded.body = body; },
  };
  await connector.handle({ method: "GET", headers: {}, url: "/api/admin/integrations/aliexpress/status" }, res, "/api/admin/integrations/aliexpress/status");
  assert.equal(recorded.status, 401);
  assert.equal(saved, false);
});
