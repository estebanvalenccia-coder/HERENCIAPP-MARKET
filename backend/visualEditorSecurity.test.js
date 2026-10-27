import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const globalHeaders = config.headers?.find((item) => item.source === "/(.*)")?.headers || [];
const get = (key) => globalHeaders.find((item) => item.key.toLowerCase() === key.toLowerCase())?.value || "";

test("real storefront editor can only frame the same origin", () => {
  assert.equal(get("X-Frame-Options"), "SAMEORIGIN");
  const csp = get("Content-Security-Policy");
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(csp, /frame-src 'self'/);
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
});

test("TikTok is allowed only as a consensual script and analytics connection", () => {
  const csp = get("Content-Security-Policy");
  assert.match(csp, /script-src [^;]*https:\/\/analytics\.tiktok\.com/);
  assert.match(csp, /connect-src [^;]*https:\/\/analytics\.tiktok\.com/);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
});

test("feature branches are not deployed automatically to production", () => {
  assert.equal(config.git?.deploymentEnabled?.main, true);
  assert.equal(config.git?.deploymentEnabled?.["**"], false);
});
