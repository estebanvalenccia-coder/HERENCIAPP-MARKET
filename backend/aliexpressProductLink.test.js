import test from "node:test";
import assert from "node:assert/strict";
import { parseAliExpressProductId } from "./aliexpressProductLink.js";

test("AliExpress URLs and product IDs identify the same original supplier product", () => {
  const id="1005009876543210";
  for (const input of [
    id,
    "https://es.aliexpress.com/item/"+id+".html?spm=a2g0o.productlist.0.0",
    "https://www.aliexpress.com/item/"+id+".html",
    "https://m.aliexpress.com/i/"+id+".html",
    "https://www.aliexpress.com/item/"+id,
    "https://aliexpress.com/item/"+id+".html",
    "https://es.aliexpress.com/item/1234567890.html?productId="+id
  ]) {
    assert.equal(parseAliExpressProductId(input),input.includes("1234567890.html")?"1234567890":id);
  }
});

test("No SSRF or product-host spoofing; unsupported short redirect links are rejected",()=>{
  for(const input of [
    "https://aliexpress.com.evil.test/item/1005009876543210.html",
    "http://es.aliexpress.com/item/1005009876543210.html",
    "https://a.aliexpress.com/_example",
    "https://127.0.0.1/item/1005009876543210.html",
    "file:///etc/passwd",
    "https://evil.test/item/1005009876543210.html",
    "SKU-ABC-123",
    ""
  ]) assert.equal(parseAliExpressProductId(input),null);
});
