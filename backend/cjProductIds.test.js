import test from "node:test";
import assert from "node:assert/strict";
import { extractCjProductId, isCjProductId } from "./cjProductIds.js";

const uuid = "12345678-1234-1234-1234-123456789abc";
const numeric = "1465145114119770112";
const uuidUrl = "https://cjdropshipping.com/product/hand-printer-p-" + uuid + ".html";
const numericUrl = "https://www.cjdropshipping.com/product/portable-mini-thermal-label-printer-p-" + numeric + ".html?ref=store";

test("CJ parser accepts both UUID and numeric product URLs", () => {
  assert.equal(extractCjProductId(uuidUrl), uuid);
  assert.equal(extractCjProductId(numericUrl), numeric);
  assert.equal(extractCjProductId(new URL(numericUrl)), numeric);
  assert.equal(extractCjProductId("https://cjdropshipping.com/product-p-" + uuid + ".html"), uuid);
  assert.equal(isCjProductId(numeric), true);
  assert.equal(isCjProductId(uuid), true);
});

test("CJ parser rejects malformed or non-CJ links", () => {
  for (const url of [
    "https://attacker.test/product-p-" + numeric + ".html",
    "https://cjdropshipping.com.attacker.test/product-p-" + numeric + ".html",
    "http://cjdropshipping.com/product-p-" + numeric + ".html",
    "https://user:password@cjdropshipping.com/product-p-" + numeric + ".html",
    "https://cjdropshipping.com/product-p-123.html",
    "https://cjdropshipping.com/product-p-" + "x".repeat(19) + ".html",
    "https://cjdropshipping.com/product-p-" + numeric + ".html/extra",
    "https://cjdropshipping.com/product-p-" + numeric + ".jpg",
    "not a valid URL",
  ]) {
    assert.equal(extractCjProductId(url), "", url);
  }
  for (const id of ["../abc", "123", "123e4567-e89b-12d3-a456-xyzxyzxyzxyz", "1234567890123456789012345", ""]) {
    assert.equal(isCjProductId(id), false, id);
  }
});
