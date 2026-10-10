import test from "node:test";
import assert from "node:assert/strict";
import { resolveCjPurchasedVariant, assertCjSupplierIdentity, verifiedCjQuoteMatches } from "./cjVariantIdentity.js";

const product={metadata:{supplierVariantId:"OLD",supplierSku:"OLD-SKU"},variants:[
  {name:"Azul · EU Plug",supplierVariantId:"VID-EU",supplierSku:"CJ-BLUE-EU"},
  {name:"Azul · US Plug",supplierVariantId:"VID-US",supplierSku:"CJ-BLUE-US"},
]};
test("selected plug uses its exact official VID/SKU, not product defaults",()=>{
  const picked=resolveCjPurchasedVariant(product,"Azul · US Plug");
  assert.deepEqual(picked,{vid:"VID-US",sku:"CJ-BLUE-US",name:"Azul · US Plug",origin:"variant"});
  assert.equal(assertCjSupplierIdentity(picked,{vid:"VID-US",sku:"CJ-BLUE-US"}),true);
  assert.throws(()=>assertCjSupplierIdentity(picked,{vid:"VID-US",sku:"CJ-BLUE-EU"}),/exactos/);
});
test("unlisted combination, absent selection and mismatched variants reject",()=>{
  assert.throws(()=>resolveCjPurchasedVariant(product,"Azul · UK Plug"),/no existe/);
  assert.throws(()=>resolveCjPurchasedVariant(product,""),/Selecciona/);
  assert.throws(()=>resolveCjPurchasedVariant({variants:[{name:"M",supplierVariantId:"VID"}]},"M"),/SKU/);
  assert.throws(()=>resolveCjPurchasedVariant({variants:[product.variants[0],product.variants[0]]},"Azul · EU Plug"),/duplicadas/);
});
test("single variant and no-option legacy records use only explicit supplier IDs",()=>{
  assert.equal(resolveCjPurchasedVariant({variants:[{name:"L",supplierVariantId:"LVID",supplierSku:"LSKU"}]},"").vid,"LVID");
  assert.equal(resolveCjPurchasedVariant({metadata:{supplierVariantId:"VID",supplierSku:"SKU"}}).sku,"SKU");
  assert.throws(()=>resolveCjPurchasedVariant({metadata:{supplierVariantId:"VID",supplierSku:"SKU"}},"Inventada"),/No existe/);
});
test("quote binds the exact variant, SKU, postal code, method, sale price and age",()=>{
  const identity=resolveCjPurchasedVariant(product,"Azul · US Plug");
  const quote={available:true,vid:identity.vid,sku:identity.sku,selectedVariant:identity.name,destination:"ES",
    postalCode:"28001",methodName:"CJPacket",salePriceEur:40,costEur:13.5,supplierTotalUsd:14.1,checkedAt:"2026-10-10T11:00:00Z"};
  const params={quote,identity,postalCode:"28001",methodName:"CJPacket",salePriceEur:40,nowMs:Date.parse("2026-10-10T11:01:00Z")};
  assert.equal(verifiedCjQuoteMatches(params),true);
  for(const change of [{postalCode:"08001"},{methodName:"Other"},{salePriceEur:39},{nowMs:Date.parse("2026-10-10T12:00:00Z")}]) {
    assert.equal(verifiedCjQuoteMatches({...params,...change}),false);
  }
  assert.equal(verifiedCjQuoteMatches({...params,quote:{...quote,vid:"VID-EU"}}),false);
});
