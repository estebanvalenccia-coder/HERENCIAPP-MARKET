import test from "node:test";
import assert from "node:assert/strict";
import {planCjAutopilotAction as plan, summarizeCjAutopilotPlans as summarize,CJ_AUTOPILOT_STAGES as S} from "./cjAutopilotExecutionPlan.js";
const policy={configured:true,mode:"simulation",livePurchasesAllowed:false,livePaymentsAllowed:false};
const ready={eligibleForSupervisedTest:true,readOnly:true,blockers:[]};
const base={id:"fulfillment-1",provider:"cj",status:"approval_required"};
test("preflight is a strictly supervised plan, never a supplier charge",()=>{
 const result=plan({record:base,policy,preflight:ready});
 assert.equal(result.stage,S.READY);
 assert.equal(result.createSupplierOrder,false);
 assert.equal(result.paySupplier,false);
 assert.equal(result.automaticPurchaseAuthorized,false);
});
test("unknown external effects are reconciled, never retried",()=>{
 for(const status of ["cj_creating","cj_creation_unknown","supplier_dispatch_unknown"])
   assert.equal(plan({record:{...base,status},policy,preflight:ready}).stage,S.CREATE_UNKNOWN);
 for(const status of ["cj_paying","cj_payment_unknown"])
   assert.equal(plan({record:{...base,status},policy,preflight:ready}).stage,S.PAYMENT_UNKNOWN);
 assert.equal(plan({record:{...base,externalOrderId:"CJ-1"},policy,preflight:ready}).stage,S.CREATE_UNKNOWN);
});
test("payment requires separate approval, never automatic payment",()=>{
 const x=plan({record:{...base,status:"payment_required",externalOrderId:"CJ-1"},policy,preflight:ready});
 assert.equal(x.stage,S.PAYMENT_REQUIRED);
 assert.equal(x.paySupplier,false);
 assert.equal(plan({record:{...base,status:"payment_required"},policy,preflight:ready}).stage,S.PAYMENT_UNKNOWN);
});
test("closed or shipped orders cannot be purchased again",()=>{
 for(const status of ["cancelled","refunded","disputed","returned","closed"])
   assert.equal(plan({record:{...base,status},policy,preflight:ready}).stage,S.STOP);
 for(const status of ["ordered","shipped","delivered"])
   assert.equal(plan({record:{...base,status},policy,preflight:ready}).stage,S.TRACKING);
});
test("strict policy, preflight and merchant authorization cannot bypass review",()=>{
 assert.equal(plan({record:base,policy:null,preflight:ready}).stage,S.REVIEW);
 assert.equal(plan({record:base,policy,preflight:{...ready,blockers:["stock unknown"]}}).stage,S.REVIEW);
 assert.equal(plan({record:base,policy,preflight:{...ready,readOnly:false}}).stage,S.REVIEW);
 assert.equal(plan({record:base,policy,preflight:ready,merchantAuthorization:{livePaymentsAllowed:true}}).stage,S.REVIEW);
 assert.equal(plan({record:base,policy:{...policy,mode:"live"},preflight:ready}).stage,S.REVIEW);
});
test("summary is informational, never a payment instruction",()=>{
 const output=summarize([{...base},{...base,id:"two",status:"cj_payment_unknown"}],{"fulfillment-1":ready},policy);
 assert.equal(output.totals[S.READY],1);
 assert.equal(output.totals[S.PAYMENT_UNKNOWN],1);
 assert.equal(output.hasAutomaticPurchases,false);
 assert.equal(output.hasAutomaticSupplierPayments,false);
 assert.ok(output.results.every(x=>!x.paySupplier&&!x.createSupplierOrder));
});
