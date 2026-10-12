import test from "node:test";
import assert from "node:assert/strict";
import {inspectCjFactorySupply,cjFactoryObservationKey,readCjFactoryObservation} from "./cjFactorySupply.js";
const vid="2074707068783022081";
const row=(factoryInventory,verifiedWarehouse=1)=>({
  variantInventories:[{vid,inventory:[{countryCode:"CN",cjInventory:0,factoryInventory,verifiedWarehouse}]}]
});
test("verified exact-VID factory supply is eligible but never merchant stock or a reservation",()=>{
 const r=inspectCjFactorySupply(row(17),vid);
 assert.equal(r.verified,true);
 assert.equal(r.available,true);
 assert.equal(r.quantity,17);
 assert.equal(r.mode,"factory");
 assert.equal(r.notReserved,true);
});
test("unverified factory stocks, even 10000 units, cannot authorize orders",()=>{
 const r=inspectCjFactorySupply(row(10000,2),vid);
 assert.equal(r.verified,false);
 assert.equal(r.available,false);
 assert.equal(r.quantity,null);
 assert.equal(r.reportedQuantity,10000);
 assert.equal(r.reason,"FACTORY_NOT_VERIFIED");
});
test("zero factory inventory is actually out of stock, not a fake positive",()=>{
 const r=inspectCjFactorySupply(row(0),vid);
 assert.equal(r.verified,true);
 assert.equal(r.available,false);
 assert.equal(r.quantity,0);
});
test("missing, conflicting, negative or other-variant sources fail closed",()=>{
 const records=[null,{},row(null),row(-2),row("nan"),
   {variantInventories:[{vid:"OTHER",inventory:[{countryCode:"CN",factoryInventory:900,verifiedWarehouse:1}]}]},
   {variantInventories:[{vid,inventory:[{countryCode:"US",factoryInventory:50,verifiedWarehouse:1}]}]},
   {variantInventories:[{vid,inventory:[{countryCode:"CN",factoryInventory:5,verifiedWarehouse:1},{countryCode:"CN",factoryInventory:900,verifiedWarehouse:1}]}]},
   {variantInventories:[{vid,inventory:[{countryCode:"CN",factoryInventory:5,verifiedWarehouse:1}]},{vid,inventory:[{countryCode:"CN",factoryInventory:900,verifiedWarehouse:1}]}]}
 ];
 for(const item of records){
   const r=inspectCjFactorySupply(item,vid);
   assert.equal(r.available,false);
   assert.equal(r.verified,false);
 }
});

test("factory supply observations are exact-variant, read-only and expire in 45 minutes",()=>{
 const productId="item-1",now=Date.parse("2026-10-12T13:00:00Z");
 const raw=JSON.stringify({productId,vid,origin:"CN",quantity:28,
   verified:true,mode:"factory",source:"cj_api",checkedAt:new Date(now).toISOString()});
 assert.equal(cjFactoryObservationKey(productId,vid),"cjFactoryObservation:v1:item-1:"+vid);
 const valid=readCjFactoryObservation(raw,{productId,vid,nowMs:now+60_000});
 assert.equal(valid.available,true);
 assert.equal(valid.mode,"factory");
 assert.equal(valid.notReserved,true);
 assert.equal(valid.checkoutRevalidates,true);
 assert.equal(readCjFactoryObservation(raw,{productId,vid,nowMs:now+50*60_000}).available,false);
 assert.equal(readCjFactoryObservation(raw,{productId,vid:"wrong",nowMs:now}).fresh,false);
 assert.equal(readCjFactoryObservation(raw,{productId:"other",vid,nowMs:now}).fresh,false);
 assert.equal(readCjFactoryObservation(raw.replace('"verified":true','"verified":false'),{productId,vid,nowMs:now}).available,false);
 assert.equal(readCjFactoryObservation(raw.replace('"quantity":28','"quantity":null'),{productId,vid,nowMs:now}).fresh,false);
});
