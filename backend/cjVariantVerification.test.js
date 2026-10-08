import test from "node:test";
import assert from "node:assert/strict";
import { verifyCjVariantPrice } from "./cjCatalogImporter.js";

const pid = "12345678-1234-1234-1234-123456789abc";
const otherPid = "aaaaaaaa-1234-1234-1234-123456789abc";
const vid = "1531107375489495040";
const valid = { pid, vid, priceUsd: 8.40, sku: "CJ-TEST" };

test("CJ uses the current verified PID variant when available", async () => {
  let fallbackCalled = false;
  const value = await verifyCjVariantPrice({ pid, vid }, {
    listVariants: async () => ({ variants: [valid] }),
    lookupVariant: async () => { fallbackCalled = true; throw new Error("unneeded"); },
  });
  assert.equal(value.priceUsd, 8.4);
  assert.equal(fallbackCalled, false);
});

test("CJ falls back to official VID endpoint when PID listing fails", async () => {
  const value = await verifyCjVariantPrice({ pid, vid }, {
    listVariants: async () => { throw new Error("CJ listing temporarily unavailable"); },
    lookupVariant: async (requestedVid) => {
      assert.equal(requestedVid, vid);
      return valid;
    },
  });
  assert.equal(value.priceUsd, 8.4);
  assert.equal(value.pid, pid);
});

test("CJ falls back when the PID listing does not include the selected variant", async () => {
  const value = await verifyCjVariantPrice({ pid, vid }, {
    listVariants: async () => ({ variants: [{ ...valid, vid: "999999999999" }] }),
    lookupVariant: async () => valid,
  });
  assert.equal(value.vid, vid);
});

test("CJ never allows fallback to a variant from a different product", async () => {
  await assert.rejects(verifyCjVariantPrice({ pid, vid }, {
    listVariants: async () => ({ variants: [] }),
    lookupVariant: async () => ({ ...valid, pid: otherPid }),
  }), (error) => error.code === "CJ_VARIANT_IDENTITY_MISMATCH");
});

test("CJ never allows a fallback price that is missing, invalid or negative", async () => {
  for (const priceUsd of [null, undefined, NaN, -1]) {
    await assert.rejects(verifyCjVariantPrice({ pid, vid }, {
      listVariants: async () => ({ variants: [] }),
      lookupVariant: async () => ({ ...valid, priceUsd }),
    }), /verificar la variante/);
  }
});

test("CJ fails closed when both official variant methods are unavailable", async () => {
  await assert.rejects(verifyCjVariantPrice({ pid, vid }, {
    listVariants: async () => { throw new Error("listing unavailable"); },
    lookupVariant: async () => { throw new Error("VID unavailable"); },
  }), (error) => error.statusCode === 502);
});

test("CJ does not allow untrusted or malformed variant IDs", async () => {
  await assert.rejects(verifyCjVariantPrice({ pid, vid: "../x" }, {
    listVariants: async () => { throw new Error("must never be called"); },
  }), (error) => error.statusCode === 422);
});
