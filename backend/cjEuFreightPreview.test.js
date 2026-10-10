import test from "node:test";
import assert from "node:assert/strict";
import { validateCjEuFreightPreview } from "./cjEuFreightPreview.js";
import { EU_COUNTRIES } from "./supplierMarketplace.js";

test("CJ preview accepts all EU countries with postal codes but never enables checkout",()=>{
 for (const country of EU_COUNTRIES) {
  const result=validateCjEuFreightPreview({destination:country,zip:country==="ES"?"08032":"12345"});
  assert.equal(result.destination,country);
  assert.equal(result.origin,"CN");
  assert.equal(result.quantity,1);
  assert.equal(result.checkoutEnabled,false);
  assert.equal(result.manualReviewRequired,true);
 }
});
test("rejects non-EU countries and missing postal codes outside Spain",()=>{
 assert.throws(()=>validateCjEuFreightPreview({destination:"US",zip:"10001"}),/UE/);
 assert.throws(()=>validateCjEuFreightPreview({destination:"GB",zip:"EC1"}),/UE/);
 assert.throws(()=>validateCjEuFreightPreview({destination:"DE",zip:""}),/código postal/);
 assert.throws(()=>validateCjEuFreightPreview({destination:"FR",zip:"<script>"}),/formato/);
 assert.throws(()=>validateCjEuFreightPreview({destination:"ES",zip:"1234"}),/cinco cifras/);
});
test("legacy Spain admin-only country preview remains accepted without ZIP",()=>{
 const result=validateCjEuFreightPreview({});
 assert.equal(result.destination,"ES");
 assert.equal(result.zip,"");
 assert.equal(result.checkoutEnabled,false);
});
