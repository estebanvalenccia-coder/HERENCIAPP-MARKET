import test from "node:test";
import assert from "node:assert/strict";
import { classifyCjApiLimit, quoteCjVariantShipping } from "./cjCatalogImporter.js";

test("CJ global code 1600200 means rate limit, not invalid zip", () => {
  assert.equal(classifyCjApiLimit(429, 1600200), "CJ_RATE_LIMITED");
  assert.equal(classifyCjApiLimit(200, 1600200), "CJ_RATE_LIMITED");
  assert.equal(classifyCjApiLimit(429, 1600201), "CJ_QUOTA_EXHAUSTED");
  assert.equal(classifyCjApiLimit(429, 429), "CJ_QUOTA_EXHAUSTED");
  assert.equal(classifyCjApiLimit(200, 200), null);
  assert.equal(classifyCjApiLimit(400, 1600300), null);
});

test("CJ auth and freight are paced, identical quotes coalesced and cached", async (t) => {
  const previousKey = process.env.CJ_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.CJ_API_KEY = "unit-test-key";
  t.after(() => {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.CJ_API_KEY;
    else process.env.CJ_API_KEY = previousKey;
  });
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push({ url: String(url), time: Date.now() });
    const isAuth = String(url).includes("authentication/getAccessToken");
    return new Response(JSON.stringify(isAuth
      ? { code: 200, result: true, data: { accessToken: "test-token" } }
      : { code: 200, result: true, data: [
          { logisticName: "CJPacket", logisticPrice: 5.25, totalPostageFee: 5.25 },
        ] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const input = { vid: "1531107375489495040", zip: "08032", destination: "ES" };
  const [first, second] = await Promise.all([
    quoteCjVariantShipping(input),
    quoteCjVariantShipping(input),
  ]);
  assert.deepEqual(first, second);
  assert.equal(first.zip, "08032");
  assert.equal(calls.length, 2, "one auth call + one freight quote for two simultaneous requests");
  assert.ok(calls[1].time - calls[0].time >= 1100, "CJ requests are not fired in a burst");
  const third = await quoteCjVariantShipping(input);
  assert.equal(third.methods[0].totalPostageUsd, 5.25);
  assert.equal(calls.length, 2, "identical quote reuses a fresh verified CJ quote");
});

test("CJ 429 produces an explicit provider error and short-circuits repeat requests", async (t) => {
  const previousFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = previousFetch; });
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts++;
    return new Response(JSON.stringify({ code: 1600200, result: false, message: "Too many requests" }), {
      status: 429, headers: { "content-type": "application/json" },
    });
  };
  await assert.rejects(quoteCjVariantShipping({
    vid: "1531107375489495055", zip: "08032", destination: "ES",
  }), (error) => error.code === "CJ_RATE_LIMITED" && error.upstreamCode === 1600200);
  await assert.rejects(quoteCjVariantShipping({
    vid: "1531107375489495066", zip: "08032", destination: "ES",
  }), (error) => error.code === "CJ_RATE_LIMITED");
  assert.equal(attempts, 1, "circuit breaker avoids hammering CJ after 429");
});
