import test from "node:test";
import assert from "node:assert/strict";
import { isPrivateSupplierStorageKey } from "./supplierInternalStorageSecurity.js";
import {aliExpressAttemptKey,pickAliExpressUnpaidCandidates,evaluateAliExpressCost,createAliExpressUnpaidRunner} from "./aliexpressUnpaidOrderRunner.js";
const id="2624b5b9-ed7b-4f6e-a9ee-7642d9a7016c";
const row={id,orderId:"c0130d64-f307-4704-bd58-d630bd54a579",supplierName:"AliExpress",
 sourceHost:"aliexpress.com",supplierId:"ae",mode:"autopilot",status:"connector_required",externalOrderId:""};
const policy={dailyMaxEur:100,perOrderMaxEur:20,minMarginPercent:25};
test("Only AliExpress autopilot rows can be considered; external/closed orders are excluded",()=>{
 const ops={suppliers:[{id:"ae",active:true}],supplierFulfillments:[
  row,{...row,id:"different",externalOrderId:"8207144545095178"},
  {...row,id:"manual",mode:"manual"},
  {...row,id:"cj",supplierName:"CJdropshipping",sourceHost:"cjdropshipping.com"},
 ]};
 assert.deepEqual(pickAliExpressUnpaidCandidates(ops).map(x=>x.id),[id]);
 assert.ok(aliExpressAttemptKey(id).startsWith("aliexpressUnpaidOrderAttempt:v1:"));
 assert.equal(isPrivateSupplierStorageKey(aliExpressAttemptKey(id)),true);
});
test("Budget assesses tax, processing fees and actual Stripe-funded sales",()=>{
 const result=evaluateAliExpressCost({order:{total:35},unitEur:8,freightEur:2,policy});
 assert.ok(result.vendorTotalEur>=12.10);
 assert.ok(result.estimatedMarginPct>25);
 assert.throws(()=>evaluateAliExpressCost({order:{total:0},unitEur:8,freightEur:2,policy}));
 assert.throws(()=>evaluateAliExpressCost({order:{total:12},unitEur:8,freightEur:8,policy}));
});
test("Worker with disabled setting makes no provider or database actions",async()=>{
 const before={...process.env};
 delete process.env.ALIEXPRESS_UNPAID_ORDER_AUTO_ENABLED;
 let calls=0;
 const deps=Object.fromEntries(["read","mutate","loadOrder","loadProduct","verifyStripePayment",
 "loadProviderProduct","quoteFreight","placeUnpaidOrder"].map(key=>[key,async()=>{calls++;throw Error("not allowed");}]));
 const worker=createAliExpressUnpaidRunner(deps);
 assert.deepEqual(await worker.sweep(),{status:"disabled",processed:0});
 assert.equal((await worker.processOne(row)).status,"not_authorized");
 assert.equal(calls,0);
 process.env=before;
});
test("Free-coupon checkout cannot touch AliExpress even with opt-ins enabled",async()=>{
 const before={...process.env};
 for(const k of ["ALIEXPRESS_LIVE_ORDER_CREATION_ENABLED","ALIEXPRESS_UNPAID_ORDER_AUTO_ENABLED",
 "ALIEXPRESS_CUSTOMER_ADDRESS_TRANSFER_APPROVED","ALIEXPRESS_PROVIDER_ORDER_API_VERIFIED"])
 process.env[k]="true";
 let remoteCalls=0,leaseCalls=0;
 const ops={suppliers:[{id:"ae",active:true}],supplierFulfillments:[row]};
 const worker=createAliExpressUnpaidRunner({
  read:async key=>key==="posOperations"?JSON.stringify(ops):null,
  mutate:async()=>{leaseCalls++;throw Error("should not write");},
  loadOrder:async()=>({id:row.orderId,status:"paid",total:0,payment_method:"coupon",stripe_payment_intent_id:null,metadata:{freeCouponOrder:true}}),
  loadProduct:async()=>{throw Error("should not load catalog");},
  verifyStripePayment:async()=>{remoteCalls++;},
  loadProviderProduct:async()=>{remoteCalls++;},
  quoteFreight:async()=>{remoteCalls++;},
  placeUnpaidOrder:async()=>{remoteCalls++;},
 });
 await assert.rejects(()=>worker.processOne(row),/cupón 100 %/);
 assert.equal(remoteCalls,0);assert.equal(leaseCalls,0);
 process.env=before;
});
