import test from "node:test";
import assert from "node:assert/strict";
import { updateSupplierHubVisibility } from "./supplierHubVisibility.js";
const src={suppliers:[{id:"cj-store",name:"CJ",active:true,fulfillmentMode:"autopilot"},
 {id:"other",active:true}],supplierFulfillments:[{id:"paid-order",supplierId:"cj-store",status:"ordered"}],
 purchases:[{id:"buy",supplierId:"cj-store"}]};
test("templates can be hidden, removed from catalog, restored without changing real supplier records",()=>{
  let a=updateSupplierHubVisibility(src,{scope:"preset",id:"bigbuy",action:"remove"}).operations;
  assert.equal(a.supplierPresetPreferences.bigbuy,"removed");
  assert.deepEqual(a.supplierFulfillments,src.supplierFulfillments);
  a=updateSupplierHubVisibility(a,{scope:"preset",id:"bigbuy",action:"restore"}).operations;
  assert.equal(a.supplierPresetPreferences.bigbuy,undefined);
  assert.throws(()=>updateSupplierHubVisibility(src,{scope:"preset",id:"fake",action:"remove"}),/no existe/i);
});
test("hide supplier only changes administration display, not its active orders",()=>{
  const result=updateSupplierHubVisibility(src,{scope:"registered",id:"cj-store",action:"hide"}).operations;
  assert.equal(result.suppliers[0].active,true);
  assert.equal(result.suppliers[0].hiddenInSupplierHub,true);
  assert.deepEqual(result.supplierFulfillments,src.supplierFulfillments);
});
test("archive disables ordering but preserves supplier id and linked order history",()=>{
  let result=updateSupplierHubVisibility(src,{scope:"registered",id:"cj-store",action:"archive"}).operations;
  assert.equal(result.suppliers[0].active,false);
  assert.equal(result.suppliers[0].fulfillmentMode,"manual");
  assert.equal(result.suppliers[0].hiddenInSupplierHub,true);
  assert.ok(result.suppliers[0].archivedAt);
  assert.deepEqual(result.supplierFulfillments,src.supplierFulfillments);
  result=updateSupplierHubVisibility(result,{scope:"registered",id:"cj-store",action:"restore"}).operations;
  assert.equal(result.suppliers[0].active,false,"restoring the panel must never reactivate paid procurement");
  assert.equal(result.suppliers[0].fulfillmentMode,"manual");
});
test("invalid actions never alter payments or supplier records",()=>{
  assert.throws(()=>updateSupplierHubVisibility(src,{scope:"registered",id:"cj-store",action:"remove"}),/no permitida/i);
  assert.throws(()=>updateSupplierHubVisibility(src,{scope:"registered",id:"missing",action:"hide"}),/No existe/i);
  assert.throws(()=>updateSupplierHubVisibility(src,{scope:"preset",id:"cj",action:"archive"}),/no permitida/i);
});
