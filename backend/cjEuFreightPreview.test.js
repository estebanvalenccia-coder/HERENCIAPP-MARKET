import test from "node:test";
import assert from "node:assert/strict";
import { validateCjEuFreightPreview } from "./cjEuFreightPreview.js";
import { EU_COUNTRIES, CJ_PREVIEW_COUNTRIES } from "./supplierMarketplace.js";

test("CJ previews all EU countries and selected international destinations without postal codes or checkout",()=>{
 for (const country of CJ_PREVIEW_COUNTRIES) {
  const result=validateCjEuFreightPreview({destination:country});
  assert.equal(result.destination,country);
  assert.equal(result.zip,"");
  assert.equal(result.precision,"country_estimate");
  assert.equal(result.origin,"CN");
  assert.equal(result.quantity,1);
  assert.equal(result.checkoutEnabled,false);
  assert.equal(result.manualReviewRequired,true);
 }
 assert.equal(EU_COUNTRIES.length,27);
 for (const country of ["US","CO","GB","CA","MX","AU","CH"]) assert.ok(CJ_PREVIEW_COUNTRIES.includes(country));
});
test("postal code improves preview precision but still never enables checkout",()=>{
 for (const [country, zip] of [["ES","08032"],["DE","10115"],["US","10001"],["CO","110111"]]) {
  const result=validateCjEuFreightPreview({destination:country,zip});
  assert.equal(result.zip,zip);
  assert.equal(result.precision,"postal_estimate");
  assert.equal(result.checkoutEnabled,false);
 }
});
test("rejects unknown countries and malformed postcodes",()=>{
 assert.throws(()=>validateCjEuFreightPreview({destination:"ZZ",zip:"10001"}),/país/);
 assert.throws(()=>validateCjEuFreightPreview({destination:"FR",zip:"<script>"}),/formato/);
 assert.throws(()=>validateCjEuFreightPreview({destination:"ES",zip:"1234"}),/cinco cifras/);
 assert.throws(()=>validateCjEuFreightPreview({destination:"US",zip:"X"}),/formato/);
});

test("gateway can estimate international shipping read-only without changing Spain live checkout",async()=>{
 const fs=await import("node:fs/promises");
 const gateway=await fs.readFile(new URL("./neonGateway.js",import.meta.url),"utf8");
 const server=await fs.readFile(new URL("./server.js",import.meta.url),"utf8");
 const checkout=await fs.readFile(new URL("./cjCheckoutSafety.js",import.meta.url),"utf8");
 const route=gateway.slice(gateway.indexOf('if(path==="/api/admin/catalog/cj-freight"'),
   gateway.indexOf('if(path==="/api/admin/catalog/cj-variants"'));
 assert.match(route,/adminSession\(req\)/);
 assert.match(route,/validateCjEuFreightPreview/);
 assert.match(route,/destination:request.destination/);
 assert.match(route,/checkoutEnabled:false/);
 assert.doesNotMatch(route,/createOrderV2|payBalance|paymentIntents/);
 assert.match(checkout,/countryCode\(shippingAddress\?\.country\) !== "ES"/);
 assert.match(server,/extractCjProductId\(sourceUrl\)/);
 assert.match(server,/assertCjSupplierIdentity\(/);
});
