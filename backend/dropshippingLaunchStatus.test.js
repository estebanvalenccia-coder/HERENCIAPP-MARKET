import test from "node:test";
import assert from "node:assert/strict";
import {buildDropshippingLaunchStatus} from "../src/app/lib/dropshippingLaunchStatus.js";

const live={id:"cj-1",integrationType:"cj",active:true,cjSandbox:false};
const product={id:"p1",metadata:{supplierId:"cj-1"}};
const successfulLocal={
 id:"f1",provider:"cj",supplierId:"cj-1",status:"ordered",
 paidAt:"2026-10-11T18:00:00Z",externalOrderId:"CJ-100",
 cjManualAuthorization:{approvedByAdminAt:"2026-10-11T17:00:00Z"},
 items:[{cjPricingEstimate:{costEur:9}}],estimatedCost:12,
};
test("an unknown API state never certifies automation or a real CJ connection",()=>{
 const state=buildDropshippingLaunchStatus({suppliers:[live],products:[product]});
 assert.equal(state.steps[0].state,"unknown");
 assert.equal(state.automaticPurchasesVerified,false);
 assert.equal(state.steps[4].state,"unknown");
 assert.equal(state.steps[1].state,"configured");
});
test("a local supervised order is evidence requiring independent verification, not a proof of automation",()=>{
 const state=buildDropshippingLaunchStatus({
  suppliers:[live],products:[product],fulfillments:[successfulLocal],
  readiness:{configured:true,readyForUnattendedBuying:false,activationBlockers:["Falta mandato"]},
 });
 assert.equal(state.steps[0].state,"configured");
 assert.equal(state.steps[2].state,"review_required");
 assert.equal(state.steps[3].state,"review_required");
 assert.equal(state.steps[4].state,"blocked");
 assert.deepEqual(state.blockers,["Falta mandato"]);
});
test("sandbox, other suppliers and unavailable data cannot make CJ ready",()=>{
 const state=buildDropshippingLaunchStatus({
  suppliers:[{...live,cjSandbox:true},{id:"manual",integrationType:"manual"}],
  products:[{metadata:{supplierId:"manual"}}],fulfillments:[],
  readiness:{configured:true,readyForUnattendedBuying:false},
 });
 assert.equal(state.steps[0].state,"action_required");
 assert.equal(state.linkedCount,0);
 assert.equal(state.steps[1].state,"action_required");
});
test("back-end authorization is presented only when explicitly confirmed",()=>{
 const state=buildDropshippingLaunchStatus({
  suppliers:[live],readiness:{configured:true,readyForUnattendedBuying:true,activationBlockers:[]},
 });
 assert.equal(state.steps[4].state,"configured");
 assert.equal(state.automaticPurchasesVerified,true);
});
