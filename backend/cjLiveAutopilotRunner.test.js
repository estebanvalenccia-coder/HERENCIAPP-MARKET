import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildCjLiveMandate,validateCjLiveMandate,CJ_LIVE_MANDATE_CONFIRMATION} from "./cjLiveAutopilotMandate.js";
import {createCjLiveAutopilotRunner,eligibleCjLiveActions} from "./cjLiveAutopilotRunner.js";
import {isPrivateSupplierStorageKey} from "./supplierInternalStorageSecurity.js";
const fixedNow=Date.parse("2026-10-11T19:20:00Z");
const supplier={id:"cj-1",integrationType:"cj",active:true,cjSandbox:false,cjMaxPaymentUsd:50};
const policy={configured:true,mode:"simulation",perOrderMaxEur:25,dailyMaxEur:70,
 minMarginPercent:30,allowedSupplierIds:["cj-1"]};
const flags={CJ_LIVE_AUTOPILOT_ENABLED:"true",CJ_LIVE_ORDER_CREATION_ENABLED:"true",CJ_LIVE_PAYMENT_ENABLED:"true"};
const mandateString=buildCjLiveMandate({
 confirmation:CJ_LIVE_MANDATE_CONFIRMATION,acknowledgeRealSupplierDebits:true,
 perOrderMaxEur:25,dailyMaxEur:70,minMarginPercent:30,allowedSupplierIds:["cj-1"],
},{policy,suppliers:[supplier],supervisedProof:true,env:flags,now:new Date(fixedNow).toISOString()});
const mandate=validateCjLiveMandate(mandateString,{policy,suppliers:[supplier],nowMs:fixedNow});
const row={id:"order1234",orderId:"paid12",supplierId:"cj-1",provider:"cj",
 status:"approval_required",estimatedCost:12,createdAt:new Date(fixedNow).toISOString()};
test("real CJ money authorization needs exact nonexpired mandate and ready vendor",()=>{
 assert.equal(mandate.valid,true);
 assert.equal(eligibleCjLiveActions({suppliers:[supplier],supplierFulfillments:[row]},mandate).length,1);
 assert.equal(eligibleCjLiveActions({suppliers:[supplier],
   supplierFulfillments:[{...row,createdAt:"2026-10-10T00:00:00Z"}]},mandate).length,0);
 assert.equal(eligibleCjLiveActions({suppliers:[{...supplier,cjSandbox:true}],supplierFulfillments:[row]},mandate).length,0);
 assert.equal(eligibleCjLiveActions({suppliers:[supplier],supplierFulfillments:[{...row,estimatedCost:30}]},mandate).length,0);
 assert.equal(eligibleCjLiveActions({suppliers:[supplier],supplierFulfillments:[{...row,status:"cj_payment_unknown"}]},mandate).length,0);
});
test("worker performs create and pay in different sweeps, never unauthorised backdoors",async()=>{
 let ops={suppliers:[supplier],supplierFulfillments:[row]};
 const storage=new Map(),steps=[];
 const runner=createCjLiveAutopilotRunner({
  readOperations:async()=>ops,readPolicy:async()=>policy,readMandate:async()=>mandateString,
  mutate:async(key,update)=>{storage.set(key,update(storage.get(key)||null));},
  preflight:async(id)=>{steps.push("preflight:"+id);return {readOnly:true,eligibleForSupervisedTest:true,blockers:[],currentCostEur:12};},
  createUnpaid:async(r,m)=>{
   steps.push("create:"+r.id);
   ops={...ops,supplierFulfillments:[{...r,status:"payment_required",
     cjAutopilotMandateAt:m.createdAt,externalOrderId:"CJ123"}]};
  },
  payExisting:async(r)=>{steps.push("pay:"+r.id);ops={...ops,supplierFulfillments:[{...r,status:"ordered"}]};},
  env:()=>flags,now:()=>fixedNow,
 });
 assert.equal((await runner.sweep()).status,"created_unpaid");
 assert.deepEqual(steps,["preflight:order1234","create:order1234"]);
 assert.equal((await runner.sweep()).status,"paid");
 assert.deepEqual(steps,["preflight:order1234","create:order1234","pay:order1234"]);
 assert.equal((await runner.sweep()).status,"no_eligible_orders");
});
test("a revoked merchant authorization or disabled flag prevents all supplier action",async()=>{
 const actions=[];
 const runner=createCjLiveAutopilotRunner({
  readOperations:async()=>({suppliers:[supplier],supplierFulfillments:[row]}),
  readPolicy:async()=>policy,readMandate:async()=>null,
  mutate:async()=>{},preflight:async()=>actions.push("preflight"),
  createUnpaid:async()=>actions.push("create"),payExisting:async()=>actions.push("pay"),
  env:()=>flags,now:()=>fixedNow,
 });
 assert.equal((await runner.sweep()).status,"merchant_mandate_missing");
 assert.deepEqual(actions,[]);
 const blocked=createCjLiveAutopilotRunner({
  readOperations:async()=>({suppliers:[supplier],supplierFulfillments:[row]}),
  readPolicy:async()=>policy,readMandate:async()=>mandateString,
  mutate:async()=>{},preflight:async()=>actions.push("preflight"),
  createUnpaid:async()=>actions.push("create"),payExisting:async()=>actions.push("pay"),
  env:()=>({...flags,CJ_LIVE_PAYMENT_ENABLED:"false"}),now:()=>fixedNow,
 });
 assert.equal((await blocked.sweep()).status,"environment_disabled");
 assert.deepEqual(actions,[]);
});
test("live activation and execution are protected, legacy direct execution cannot bypass ledger",()=>{
 const server=readFileSync(new URL("./server.js",import.meta.url),"utf8");
 assert.match(server,/createCjLiveAutopilotRunner/);
 assert.match(server,/createCjAutopilotUnpaid/);
 assert.match(server,/payCjAutopilotExisting/);
 assert.match(server,/CJ_LIVE_MANDATE_KEY/);
 assert.match(server,/CJ_LIVE_RUNNER_LEASE|createCjLiveAutopilotRunner/);
 assert.match(server,/reserveCjDailyBudget/);
 assert.match(server,/settleCjBudgetReservation/);
 const legacyStart=server.indexOf("async function executeCjSupplierFulfillment(");
 const legacyEnd=server.indexOf("// Reuse the existing CJ credentials",legacyStart);
 const legacy=server.slice(legacyStart,legacyEnd);
 assert.ok(legacyStart>0&&legacyEnd>legacyStart);
 assert.match(legacy,/SECURITY: the historical 'execute' path/);
 assert.match(legacy,/if \(supplier\?\.cjSandbox === false\)/);
 const cjRequestBlock=server.slice(server.indexOf("async function cjRequest("),server.indexOf("async function cjPayOrder("));
 assert.match(cjRequestBlock,/method\.toUpperCase\(\) === "GET"/);
 assert.equal(isPrivateSupplierStorageKey("cjAutopilotLiveMandate:v1"),true);
 assert.equal(isPrivateSupplierStorageKey("cjAutopilotLiveRunnerLease:v1"),true);
});
