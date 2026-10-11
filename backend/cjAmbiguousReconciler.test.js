import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {pickCjReconciliationCandidates,projectCjAmbiguousReconciliation,
  createCjAmbiguousReconciler} from "./cjAmbiguousReconciler.js";
import {isPrivateSupplierStorageKey} from "./supplierInternalStorageSecurity.js";

const supplier={id:"cj-1",integrationType:"cj",cjMaxPaymentUsd:50,active:true,cjSandbox:false};
const record={
  id:"fulfill-123",orderId:"order-123",provider:"cj",supplierId:supplier.id,
  status:"cj_payment_unknown",externalOrderId:"CJ123456",
  cjManualAuthorization:{approvedMaxUsd:35},
};
const paid={orderId:"CJ123456",orderStatus:"PAID",actualPayment:21,shipmentOrderId:"SHIP1"};

test("only positively verified CJ IDs and bounded money change ambiguous states",()=>{
 const ok=projectCjAmbiguousReconciliation(record,supplier,paid);
 assert.equal(ok.verified,true);
 assert.equal(ok.patch.status,"ordered");
 assert.equal(ok.patch.providerActualPayment,21);
 assert.equal(ok.retryAllowed,false);
 for(const bad of [
   {...paid,orderId:"CJ999"},
   {...paid,actualPayment:51},
   {...paid,actualPayment:36},
   {...paid,actualPayment:""},
   {...paid,actualPayment:null},
   {...paid,orderStatus:"UNKNOWN"},
 ]){
   const result=projectCjAmbiguousReconciliation(record,supplier,bad);
   assert.equal(result.verified,false);
   assert.equal(result.patch,null);
 }
 assert.equal(projectCjAmbiguousReconciliation({...record,cjShipmentOrderId:"DIFFERENT"},supplier,paid).verified,false);
});

test("an unknown payment cannot be retried merely because CJ says unpaid",()=>{
 const result=projectCjAmbiguousReconciliation(record,supplier,{...paid,orderStatus:"UNPAID"});
 assert.equal(result.verified,false);
 assert.equal(result.reason,"payment_ambiguous_must_remain_locked");
 const created=projectCjAmbiguousReconciliation({...record,status:"cj_creation_unknown"},supplier,{...paid,orderStatus:"UNPAID"});
 assert.equal(created.verified,true);
 assert.equal(created.patch.status,"payment_required");
 assert.equal(created.retryAllowed,false);
});

test("only ambiguous records with real external IDs are reconciled",()=>{
 const match=pickCjReconciliationCandidates([
  {...record,externalOrderId:""},
  {...record,status:"approval_required"},
  {...record,id:"second-123",externalOrderId:"CJ999999"},
  {...record,id:"third-123",externalOrderId:"CJ888888"},
 ],[supplier],{limit:100});
 assert.equal(match.length,2);
 assert.equal(pickCjReconciliationCandidates([record],[{...supplier,integrationType:"manual"}]).length,0);
});

test("background reconciler GETs at most one existing order, never debits balance",async()=>{
 const kv=new Map(),actions=[],inspected=[];
 const options={
   load:async()=>({suppliers:[supplier],supplierFulfillments:[record]}),
   fetchRemote:async id=>{inspected.push(id);return paid;},
   apply:async (original,patch,{remote})=>{
     assert.equal(original.id,record.id);
     assert.equal(remote.orderId,record.externalOrderId);
     actions.push(patch);
   },
   mutate:async (key,fn)=>{
     const next=fn(kv.get(key)||null);
     kv.set(key,next);
     return {value:next};
   },
   now:()=>Date.parse("2026-10-11T19:30:00Z"),
 };
 const runner=createCjAmbiguousReconciler(options);
 const result=await runner.sweep();
 assert.deepEqual({status:result.status,checked:result.checked,changed:result.changed},
   {status:"confirmed_paid",checked:1,changed:1});
 assert.deepEqual(inspected,["CJ123456"]);
 assert.equal(actions.length,1);
 assert.equal(actions[0].status,"ordered");
 assert.equal(actions[0].providerActualPayment,21);
});

test("lease blocks parallel workers, and payment uncertainty remains unchanged",async()=>{
 const now=Date.parse("2026-10-11T19:30:00Z");
 const kv=new Map([["cjAutopilotReconciliationLease:v1",JSON.stringify({owner:"other",expiresAt:now+90_000})]]);
 const actions=[];
 const deps={
   load:async()=>({suppliers:[supplier],supplierFulfillments:[record]}),
   fetchRemote:async()=>{throw Error("Should not query remote");},
   apply:async()=>actions.push("illegal"),
   mutate:async(k,fn)=>{kv.set(k,fn(kv.get(k)||null));return {value:kv.get(k)};},
   now:()=>now,
 };
 assert.equal((await createCjAmbiguousReconciler(deps).sweep()).status,"another_worker");
 assert.deepEqual(actions,[]);
 assert.equal(isPrivateSupplierStorageKey("cjAutopilotReconciliationLease:v1"),true);
 assert.equal(isPrivateSupplierStorageKey("cjAutopilotReconciliationCursor:v1"),true);
});

test("real server wires reconciliation to read-only CJ GET and atomic state CAS",()=>{
 const server=readFileSync(new URL("./server.js",import.meta.url),"utf8");
 const begin=server.indexOf("const cjAmbiguousReconciler=createCjAmbiguousReconciler");
 const end=server.indexOf("// Live procurement uses",begin);
 assert.ok(begin>0 && end>begin);
 const block=server.slice(begin,end);
 assert.match(block,/\/shopping\/order\/getOrderDetail/);
 assert.match(block,/mutateCjManualRecord/);
 assert.match(block,/projectCjAmbiguousReconciliation/);
 assert.doesNotMatch(block,/createOrderV2|cjPayOrder|payBalance|stripe\.paymentIntents|refunds\.create/);
 assert.match(server,/CJ_READ_ONLY_RECONCILIATION_ENABLED/);
});
