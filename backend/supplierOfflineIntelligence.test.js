import test from "node:test";
import assert from "node:assert/strict";
import {
 verifiedGtin,suggestSupplierMatches,checkSupplierFileAlerts,offlinePricingSuggestion,UNIVERSAL_CONNECTOR_CONTRACT
} from "./supplierOfflineIntelligence.js";

test("GTIN check digit is required; product title or supplier SKU never auto-links",()=>{
 assert.equal(verifiedGtin("4006381333931"),"4006381333931");
 assert.equal(verifiedGtin("4006381333932"),"");
 assert.equal(verifiedGtin("not-a-gtin"),"");
 const catalog=[
  {id:"a",name:"Maceta",metadata:{supplierId:"A",gtin:"4006381333931",manufacturer:"Herencia"}},
  {id:"b",name:"Maceta",metadata:{supplierId:"B",gtin:"4006381333931"}},
  {id:"c",name:"Maceta",metadata:{supplierId:"C"}},
  {id:"d",name:"Maceta",metadata:{supplierId:"D",gtin:"4006381333932"}}
 ];
 const result=suggestSupplierMatches(catalog);
 assert.equal(result.total,1);
 assert.equal(result.candidates[0].reason,"gtin");
 assert.equal(result.candidates[0].reviewRequired,true);
 assert.equal(result.candidates[0].automaticSupplierSwitching,false);
 assert.equal(result.automaticMatches,0);
});
test("manufacturer+MPN is a manual candidate, but an identical brand alone is insufficient",()=>{
 const catalog=[
  {id:"a",metadata:{supplierId:"A",manufacturer:"Example Co",mpn:"MODEL-77"}},
  {id:"b",metadata:{supplierId:"B",manufacturer:"Example Co",mpn:"MODEL-77"}},
  {id:"c",metadata:{supplierId:"C",manufacturer:"Example Co"}},
 ];
 assert.equal(suggestSupplierMatches(catalog).total,1);
 assert.equal(suggestSupplierMatches(catalog).candidates[0].reason,"manufacturer_mpn");
});
test("variant-specific changes include stock and unit costs, never change storefront stock",()=>{
 const old=[{supplierVariantId:"v1",supplierSku:"EU",variantName:"EU plug",cost:10,currency:"USD",stock:8}];
 const next=[{supplierVariantId:"v1",supplierSku:"EU",variantName:"EU plug",cost:12,currency:"USD",stock:0},
  {supplierVariantId:"v2",supplierSku:"US",variantName:"US plug",cost:10,currency:"USD",stock:1}];
 const result=checkSupplierFileAlerts(old,next,{productId:"p"});
 assert.deepEqual(result.alerts.map(a=>a.type),["cost_increase","supplier_reports_out_of_stock","new_variant"]);
 assert.equal(result.automaticStockChanges,0);
 assert.equal(result.automaticPriceChanges,0);
 assert.equal(result.stockVerifiedByApi,false);
});
test("supplier identity is required to compare variants safely",()=>{
 const a=[{supplierVariantId:"",supplierSku:"x",stock:4,cost:10,currency:"EUR"}];
 assert.equal(checkSupplierFileAlerts(a,[]).alerts.length,0);
});
test("pricing covers EU VAT, exchange, shipping and fees while remaining unverified",()=>{
 const params={
  supplierVariantId:"V-EU",currency:"USD",productCost:10,
  shippingCost:4,otherCosts:1,fixedFeeEur:0.5,percentFee:2,
  fxEurPerUnit:0.9,fxCheckedAt:"2026-10-10T10:05:00Z",
  shippingCheckedAt:"2026-10-10T10:06:00Z",
  destination:"ES",postalCode:"08032",vatPercent:21,minimumMarginPercent:30,
  nowMs:Date.parse("2026-10-10T10:10:00Z")
 };
 const p=offlinePricingSuggestion(params);
 assert.ok(p.suggestedRetailEur>20);
 assert.ok(p.expectedMarginPercent>=29.9);
 assert.equal(p.publicationAllowed,false);
 assert.equal(p.automaticPurchasesEnabled,false);
 assert.equal(p.shippingQuoteRequiresRecheck,true);
 assert.equal(p.destination,"ES");
});
test("expired freight, unknown exchange, missing tax or non-EU quote must fail closed",()=>{
 const base={supplierVariantId:"VID",currency:"USD",productCost:1,shippingCost:2,
   fxEurPerUnit:.95,fxCheckedAt:"2026-10-10T10:06:00Z",
   shippingCheckedAt:"2026-10-10T10:05:00Z",
   destination:"FR",postalCode:"75001",vatPercent:20,nowMs:Date.parse("2026-10-10T10:07:00Z")};
 for(const patch of [
  {destination:"US"},{postalCode:""},{vatPercent:undefined},{fxEurPerUnit:undefined},
  {shippingCheckedAt:"2026-10-10T09:00:00Z"},{quantity:2},
  {shippingCurrency:"USD"},{productCost:"-10"}
 ])assert.throws(()=>offlinePricingSuggestion({...base,...patch}));
});
test("connector contract cannot imply live connectivity, payment or auto-orders",()=>{
 assert.equal(UNIVERSAL_CONNECTOR_CONTRACT.defaultOrderMode,"disabled");
 assert.equal(UNIVERSAL_CONNECTOR_CONTRACT.paymentAutomatic,false);
 assert.ok(UNIVERSAL_CONNECTOR_CONTRACT.safeguards.includes("idempotency"));
 assert.ok(UNIVERSAL_CONNECTOR_CONTRACT.required.includes("return_request"));
});
