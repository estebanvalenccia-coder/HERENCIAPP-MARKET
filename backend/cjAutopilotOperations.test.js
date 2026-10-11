import test from "node:test";
import assert from "node:assert/strict";
import {triageCjAutopilotRecord,summarizeCjAutopilotOperations} from "./cjAutopilotOperations.js";

const NOW=Date.parse("2026-10-11T18:00:00Z");
const supplier={id:"cj",integrationType:"cj",active:true,cjSandbox:false};
const policy={configured:true,mode:"simulation",perOrderMaxEur:25,dailyMaxEur:75,minMarginPercent:30,allowedSupplierIds:["cj"]};
const order={id:"order",status:"paid"};
const quote={available:true,vid:"VID-1",sku:"SKU-1",selectedVariant:"Red",destination:"ES",postalCode:"28001",methodName:"CJPacket",salePriceEur:40,checkedAt:"2026-10-11T17:59:00Z",costEur:16,supplierTotalUsd:18};
const record={id:"fulfillment",orderId:"order",supplierId:"cj",provider:"cj",status:"approval_required",estimatedCost:16,shippingAddress:{country:"ES",postalCode:"28001"},items:[{quantity:1,supplierVariantId:"VID-1",supplierSku:"SKU-1",selectedVariant:"Red",salePrice:40,supplierCost:16,cjPreferredLogisticName:"CJPacket",cjPricingEstimate:quote}]};
const assess=(delta={},s=supplier,o=order,p=policy)=>triageCjAutopilotRecord({...record,...delta},s,o,{policy:p,nowMs:NOW});

test("a locally consistent CJ order can only enter a live read-only preflight",()=>{
 const a=assess();
 assert.equal(a.action,"run_live_preflight");
 assert.equal(a.eligibleForLivePreflight,true);
 assert.equal(a.autoPurchaseAuthorized,false);
 assert.equal(a.safeToRetryCreation,false);
 assert.equal(a.safeToRetryPayment,false);
 assert.equal(a.financialSideEffect,false);
});

test("uncertain supplier create and payment never retry",()=>{
 for(const status of ["cj_creation_unknown","cj_payment_unknown"]){
   const r=assess({status,externalOrderId:"cj-order"});
   assert.equal(r.severity,"critical");
   assert.equal(r.action,"reconcile_remote");
   assert.equal(r.safeToRetryPayment,false);
 }
 assert.equal(assess({status:"cj_paying",updatedAt:"2026-10-11T17:35:00Z"}).stage,"reconciliation");
 assert.equal(assess({status:"cj_paying",updatedAt:"2026-10-11T17:59:00Z"}).stage,"in_progress");
});

test("invalid supplier, address, payment, quote or budget get actionable blockers",()=>{
 assert.equal(assess({},null).action,"configure_supplier");
 assert.equal(assess({},supplier,{...order,status:"unpaid"}).action,"review_customer_payment");
 assert.equal(assess({shippingAddress:{country:"FR",postalCode:"75001"}}).action,"repair_variant_address");
 assert.equal(assess({items:[{...record.items[0],quantity:2}]}).action,"repair_variant_address");
 assert.equal(assess({items:[{...record.items[0],cjPricingEstimate:{...quote,checkedAt:"2026-10-11T16:00:00Z"}}]}).action,"refresh_quote");
 assert.equal(assess({},supplier,order,null).action,"configure_budget");
 assert.equal(assess({estimatedCost:40}).action,"review_budget");
 assert.equal(assess({status:"payment_required",externalOrderId:"cj-order"}).action,"approve_supplier_payment");
});

test("cash guard considers full queue rather than truncated visible rows",()=>{
 const committed={...record,id:"committed",status:"ordered",estimatedCost:40,updatedAt:"2026-10-11T15:00:00Z"};
 const values={records:[record],exposureRecords:[record,committed],suppliers:[supplier],orders:[order],policy,nowMs:NOW};
 const a=summarizeCjAutopilotOperations(values);
 assert.equal(a.counts.total,1);
 assert.equal(a.budget.spentOrCommittedEur,40);
 assert.equal(a.budget.remainingEur,35);
 assert.equal(a.automaticPurchasesEnabled,false);
 const b=summarizeCjAutopilotOperations({...values,exposureRecords:[record,{...committed,estimatedCost:0}]});
 assert.equal(b.budget.exposureVerified,false);
 assert.equal(b.budget.remainingEur,null);
});
