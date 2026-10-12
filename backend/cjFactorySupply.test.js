import test from "node:test";
import assert from "node:assert/strict";
import {inspectCjFactorySupply} from "./cjFactorySupply.js";
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
