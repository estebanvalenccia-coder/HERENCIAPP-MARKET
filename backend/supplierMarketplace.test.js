import test from "node:test";
import assert from "node:assert/strict";
import { compareSupplierOffers, EU_COUNTRIES, SUPPLIER_PRESETS } from "./supplierMarketplace.js";

const now=Date.parse("2026-10-10T10:00:00Z");
const req={canonicalProductId:"herencia-watering-can",exactVariantKey:"green-1l",
  destination:"FR",postalCode:"75001",quantity:1,salePriceEur:20,vatRate:20,minimumMarginPercent:20};
const base={supplierId:"a",supplierName:"Supplier A",canonicalProductId:req.canonicalProductId,
  exactVariantKey:req.exactVariantKey,supplierVariantId:"A-EU",destination:"FR",postalCode:"75001",
  authorizedCatalog:true,supplierActive:true,stockAvailable:true,authorizedOrderApi:false,
  checkedAt:"2026-10-10T09:59:00Z",currency:"EUR",productCost:2,shippingCost:6,otherCosts:0,deliveryDays:8};
test("supports 27 EU countries and supplier presets without asserting access",()=>{
  assert.equal(EU_COUNTRIES.length,27);
  assert.equal(new Set(EU_COUNTRIES).size,27);
  assert.equal(SUPPLIER_PRESETS.find(s=>s.id==="temu").api,"dropshipping_unverified");
});
test("picks lowest total delivered cost, not lowest item price; never buys",()=>{
  const r=compareSupplierOffers(req,[base,{...base,supplierId:"b",productCost:3,shippingCost:2,deliveryDays:4,authorizedOrderApi:true}],{nowMs:now});
  assert.equal(r.best.supplierId,"b");
  assert.equal(r.best.landedCostEur,5);
  assert.equal(r.best.mode,"api_ready");
  assert.equal(r.automaticPurchasesEnabled,false);
});
test("rejects unverified catalogs, variant mismatches, expired quotes and missing freight",()=>{
  const bad=[{...base,canonicalProductId:"another"},{...base,exactVariantKey:"blue-1l"},
    {...base,authorizedCatalog:false},{...base,checkedAt:"2026-10-09T09:00:00Z"},
    {...base,shippingCost:null},{...base,destination:"DE"},{...base,stockAvailable:false}];
  const r=compareSupplierOffers(req,bad,{nowMs:now});
  assert.equal(r.best,null);
  assert.equal(r.excluded.length,bad.length);
});
test("USD comparison requires an explicit checked exchange rate, no guessing",()=>{
  const offer={...base,currency:"USD",productCost:4,shippingCost:4};
  assert.equal(compareSupplierOffers(req,[offer],{nowMs:now}).best,null);
  const r=compareSupplierOffers(req,[offer],{nowMs:now,eurPerCurrency:{USD:0.9}});
  assert.equal(r.best.landedCostEur,7.2);
});
test("one-unit and verified destination restrictions fail closed",()=>{
  assert.throws(()=>compareSupplierOffers({...req,quantity:2},[base]),/cantidad 1/);
  assert.throws(()=>compareSupplierOffers({...req,destination:"US"},[base]),/país UE/);
});
