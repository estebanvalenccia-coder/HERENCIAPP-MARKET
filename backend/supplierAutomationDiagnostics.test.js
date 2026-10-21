import test from "node:test";
import assert from "node:assert/strict";
import {diagnoseAliExpressQueueRow,summarizeAliExpressAutomation} from "./supplierAutomationDiagnostics.js";

const goodFlags={unpaidOrderCreationEnabled:true,automaticUnpaidCreationEnabled:true,
  orderApiVerified:true,addressTransferApproved:true};
const item={quantity:1,supplierSku:"SKU-1",supplierVariantId:"VID-1",productId:"product-1"};
const row={id:"fulfillment-1",orderId:"order-1",supplierId:"supplier-1",
  mode:"autopilot",status:"connector_required",estimatedCost:8,items:[item]};
const product={status:"active",metadata:{sourceProvider:"aliexpress",
  orderAutomationEnabled:true,costAndShippingVerified:true,
  complianceVerified:true,approvedForPublication:true}};

test("A zero-euro order cannot be treated as locally eligible for AliExpress",()=>{
 const state=diagnoseAliExpressQueueRow({...row,estimatedCost:0,items:[{quantity:1}]},
  {total:0,stripe_payment_intent_id:null},product,goodFlags);
 assert.equal(state.localChecksPassed,false);
 assert.ok(state.issues.some(msg=>msg.includes("Stripe")));
 assert.ok(state.issues.some(msg=>msg.includes("SKU")));
 assert.ok(state.issues.some(msg=>msg.includes("coste")));
 assert.equal(state.createsOrder,false);
 assert.equal(state.chargesSupplier,false);
});
test("Catalog API credentials alone do not authorize purchasing",()=>{
 const state=diagnoseAliExpressQueueRow(row,{total:20,stripe_payment_intent_id:"pi_example"},
  product,{...goodFlags,orderApiVerified:false});
 assert.ok(state.issues.some(msg=>msg.includes("Permiso de API")));
});
test("Even clean local checks never authorize charging a supplier",()=>{
 const state=diagnoseAliExpressQueueRow(row,{total:20,stripe_payment_intent_id:"pi_example"},product,goodFlags);
 assert.equal(state.localChecksPassed,true);
 assert.equal(state.chargesSupplier,false);
});
test("Diagnostics only include records belonging to the configured AliExpress supplier",()=>{
 const rows=summarizeAliExpressAutomation({suppliers:[
  {id:"supplier-1",name:"AliExpress",active:true},
  {id:"supplier-2",name:"CJdropshipping",active:true}],
  supplierFulfillments:[row,{...row,id:"cj-1",supplierId:"supplier-2"}]},
  {"order-1":{total:0}},{"product-1":product},goodFlags);
 assert.equal(rows.length,1);
 assert.equal(rows[0].fulfillmentId,"fulfillment-1");
});
