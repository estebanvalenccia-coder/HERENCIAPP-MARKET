import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { interpretCjWarehouseStocks } from "./cjCatalogImporter.js";
import { validateCjEuFreightPreview } from "./cjEuFreightPreview.js";

const vid="1531107375489495040";

test("warehouse stock includes only the exact CJ VID and origin; never invents inventory",()=>{
  const observed=interpretCjWarehouseStocks([
    {vid,countryCode:"CN",storageNum:0},
    {vid,countryCode:"US",storageNum:3},
    {vid,countryCode:"us",storageNum:"4"},
    {vid:"OTHER",countryCode:"DE",storageNum:999},
    {vid,countryCode:"DE",storageNum:0},
  ],vid);
  assert.equal(observed.verified,true);
  assert.deepEqual(observed.warehouses.find(x=>x.countryCode==="US"),{
    countryCode:"US",verified:true,quantity:7,available:true
  });
  assert.equal(observed.warehouses.find(x=>x.countryCode==="CN").available,false);
  assert.equal(observed.warehouses.some(x=>x.countryCode==="DE"&&x.available),false);
  assert.equal(observed.warehouses.length,3);
  assert.equal(interpretCjWarehouseStocks(null,vid).verified,false);
});

test("missing, non-numeric, negative or conflicting warehouse stock is unverified",()=>{
  const r=interpretCjWarehouseStocks([
    {vid,countryCode:"DE",storageNum:""},
    {vid,countryCode:"US",storageNum:5},
    {vid,countryCode:"US",storageNum:-4},
    {vid,countryCode:"XX",storageNum:"NaN"},
    {vid,countryCode:"CA",storageNum:null},
  ],vid);
  for(const country of ["DE","US","XX","CA"]){
    const entry=r.warehouses.find(w=>w.countryCode===country);
    assert.equal(entry.available,false);
    assert.equal(entry.verified,false);
  }
});

test("a selected origin is a read-only preview and never changes checkout",()=>{
  const requested=validateCjEuFreightPreview({origin:"US",destination:"ES",zip:"08001"});
  assert.equal(requested.origin,"US");
  assert.equal(requested.checkoutEnabled,false);
  assert.equal(requested.manualReviewRequired,true);
  assert.throws(()=>validateCjEuFreightPreview({origin:"ZZZ"}),/origen/);
  assert.throws(()=>validateCjEuFreightPreview({origin:"<script>"}),/origen/);
  const gateway=readFileSync(new URL("./neonGateway.js",import.meta.url),"utf8");
  const start=gateway.indexOf('if(path==="/api/admin/catalog/cj-freight"');
  const end=gateway.indexOf('if(path==="/api/admin/catalog/cj-variants"',start);
  const code=gateway.slice(start,end);
  assert.match(code,/adminSession\(req\)/);
  assert.match(code,/request\.origin!=="CN"/);
  assert.match(code,/queryCjVariantWarehouses\(\{vid\}\)/);
  assert.match(code,/row\.verified===true && row\.available===true/);
  assert.match(code,/checkoutEnabled:false/);
  assert.doesNotMatch(code,/createOrderV2|payBalance|paymentIntents/);
  const checkout=readFileSync(new URL("./cjCheckoutSafety.js",import.meta.url),"utf8");
  assert.match(checkout,/origin:"CN"/);
  const panel=readFileSync(new URL("../src/app/components/admin/AdminSuppliersPanel.tsx",import.meta.url),"utf8");
  assert.match(panel,/quoteOrigin === "CN" && freightQuote\?\.origin === "CN"/);
});
