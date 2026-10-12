import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 isCjTrackingCandidate,pickCjTrackingCandidates,projectCjTracking,explainCjAutomationReadiness,
} from "./cjTrackingAutomation.js";
import {createCjTrackingRunner} from "./cjTrackingRunner.js";
import {validateCjLiveWarehouseStock} from "./cjManualApproval.js";

const NOW=Date.parse("2026-10-11T10:00:00.000Z");
const supplier={id:"supplier-cj",active:true,integrationType:"cj",cjSandbox:false,
  cjMaxPaymentUsd:40,maxAutoOrderTotal:50};
const record={
  id:"fulfill-1",provider:"cj",supplierId:supplier.id,orderId:"herencia-0001",
  externalOrderId:"cj-order-1",status:"ordered",updatedAt:"2026-10-11T09:00:00.000Z",
  providerSyncedAt:"2026-10-11T09:10:00.000Z",
  supplierName:"CJdropshipping",items:[{quantity:1,supplierVariantId:"VID",supplierSku:"SKU"}],
  shippingAddress:{country:"ES",postalCode:"28001"},
};
const remote={orderId:"cj-order-1",orderStatus:"SHIPPED",trackNumber:"TRACK123",
  trackingUrl:"https://track.example.com/T123"};

test("tracking only selects paid-and-ordered CJ shipments, never payments or unknown creations",()=>{
 assert.equal(isCjTrackingCandidate(record,supplier,{nowMs:NOW}),true);
 for(const status of [
  "approval_required","payment_required","cj_creating","cj_creation_unknown",
  "cj_paying","cj_payment_unknown","cancelled","disputed","action_required"
 ]) assert.equal(isCjTrackingCandidate({...record,status},supplier,{nowMs:NOW}),false,status);
 assert.equal(isCjTrackingCandidate({...record,externalOrderId:""},supplier,{nowMs:NOW}),false);
 assert.equal(isCjTrackingCandidate(record,{...supplier,active:false},{nowMs:NOW}),false);
 assert.equal(isCjTrackingCandidate({...record,providerSyncedAt:"2026-10-11T09:59:00Z"},
  supplier,{nowMs:NOW}),false);
});
test("select at most three oldest eligible shipments for read-only syncing",()=>{
 const all=[0,1,2,3,4].map(i=>({...record,id:"f"+i,
  providerSyncedAt:"2026-10-11T09:0"+i+":00.000Z"}));
 assert.deepEqual(pickCjTrackingCandidates(all,[supplier],{nowMs:NOW,limit:20}).map(x=>x.id),
  ["f0","f1","f2"]);
});
test("CJ order IDs must match; only monotonic statuses are accepted",()=>{
 assert.equal(projectCjTracking(record,{...remote,orderId:"OTHER"}).reason,"order_id_mismatch");
 assert.equal(projectCjTracking(record,{...remote,orderStatus:"SOMETHING"}).reason,
  "remote_status_requires_review");
 assert.equal(projectCjTracking({...record,status:"shipped"},
  {...remote,orderStatus:"PAID"}).reason,"status_regression");
 assert.equal(projectCjTracking({...record,status:"cj_payment_unknown"},remote).accepted,false);
});
test("tracking URLs are HTTPS and carrier references never silently change",()=>{
 const x=projectCjTracking(record,{...remote,trackingUrl:"javascript:alert(1)"});
 assert.equal(x.accepted,true);
 assert.equal(x.patch.status,"shipped");
 assert.equal(x.patch.trackingNumber,"TRACK123");
 assert.equal(x.patch.trackingUrl,"");
 assert.equal(x.meaningfulChange,true);
 const bad=projectCjTracking({...record,trackingNumber:"OLD"},remote);
 assert.equal(bad.accepted,false);
 assert.equal(bad.reason,"tracking_number_changed");
});
function harness({
 statuses=[record],remotes={["cj-order-1"]:remote},
 nowMs=NOW
}={}){
 let state={suppliers:[supplier],supplierFulfillments:statuses.map(x=>({...x}))};
 const leases=new Map(),notices=[],updates=[],lookups=[];
 const runner=createCjTrackingRunner({
  readOperations:async()=>JSON.parse(JSON.stringify(state)),
  readRemote:async id=>{lookups.push(id);return remotes[id];},
  mutateOperations:async fn=>{state=JSON.parse(fn(JSON.stringify(state)));return {value:JSON.stringify(state)};},
  claimLease:async(key,fn)=>{leases.set(key,fn(leases.get(key)||""));},
  readOrder:async(id)=>({id,metadata:{source:"test"}}),
  patchOrder:async(id,payload)=>{updates.push({id,payload});},
  notify:async message=>{notices.push(message);},
  now:()=>nowMs,delay:async()=>{},
 });
 return {runner,state:()=>state,lookups,leases,notices,updates};
}
test("sync persists only verified tracking and status; leaves money and supplier action flags alone",async()=>{
 const h=harness();
 const result=await h.runner.syncOne(record);
 assert.equal(result.readOnly,true);
 assert.equal(result.fulfillment.status,"shipped");
 assert.equal(result.fulfillment.trackingNumber,"TRACK123");
 assert.equal(h.state().supplierFulfillments[0].status,"shipped");
 assert.equal(h.state().supplierFulfillments[0].providerActualPayment,undefined);
 assert.equal(h.updates.length,1);
 assert.equal(h.updates[0].payload.metadata.source,"test");
 assert.equal(h.notices.length,1);
 assert.equal(h.lookups.length,1);
});
test("concurrently modified CJ status invalidates worker compare-and-swap",async()=>{
 const h=harness();
 const original={...record};
 await h.runner.syncOne(original);
 await assert.rejects(h.runner.syncOne(original),/cambiado/);
 assert.equal(h.state().supplierFulfillments[0].status,"shipped");
});
test("ambiguous CJ payment stays locked and cannot contact supplier in tracking worker",async()=>{
 const locked={...record,status:"cj_payment_unknown"};
 const h=harness({statuses:[locked]});
 await assert.rejects(h.runner.syncOne(locked),/revisión manual/);
 assert.deepEqual(h.lookups,[]);
});
test("batch polling leases protect repeated read-only checks; no payments or purchases",async()=>{
 const entries=[1,2,3,4].map(i=>({...record,id:"fulfill-"+i,
  externalOrderId:"cj-"+i,providerSyncedAt:"2026-10-11T08:00:00Z"}));
 const remotes=Object.fromEntries([1,2,3,4].map(i=>["cj-"+i,{
  orderId:"cj-"+i,orderStatus:"SHIPPED",trackNumber:"T"+i,trackingUrl:""
 }]));
 const h=harness({statuses:entries,remotes});
 const a=await h.runner.sweep();
 assert.equal(a.checked,3);
 assert.equal(a.changed,3);
 assert.equal(a.automaticSupplierOrders,false);
 assert.equal(a.automaticSupplierPayments,false);
 const b=await h.runner.sweep();
 assert.equal(b.checked,1);
 assert.equal(h.lookups.length,4);
});
test("readiness never authorizes unattended purchasing from env switches alone",()=>{
 const snapshot=explainCjAutomationReadiness({record,supplier,
   order:{id:record.orderId,status:"paid"},
   env:{CJ_API_KEY:"present",CJ_LIVE_ORDER_CREATION_ENABLED:"true",
    CJ_LIVE_PAYMENT_ENABLED:"true"},nowMs:NOW});
 assert.equal(snapshot.readyForUnattendedBuying,false);
 assert.equal(snapshot.autoPurchaseEnabled,false);
 assert.equal(snapshot.autoPaymentEnabled,false);
 assert.ok(snapshot.blockers.some(x=>x.includes("Stripe")));
});
test("admin CJ tracking and status routes never call purchase, pay or refund functions",()=>{
 const source=readFileSync(new URL("./server.js",import.meta.url),"utf8");
 const b=source.indexOf('app.get("/api/admin/suppliers/cj/automation-readiness"');
 const e=source.indexOf('app.post("/api/admin/suppliers/cj/test"',b);
 assert.ok(b>0&&e>b);
 const block=source.slice(b,e);
 assert.match(block,/requireAdmin/);
 assert.match(block,/cjTrackingRunner\.sweep/);
 assert.match(block,/explainCjAutomationReadiness/);
 assert.doesNotMatch(block,/createOrderV2|cjPayOrder|paymentIntents|payBalance/);
 const runner=readFileSync(new URL("./cjTrackingRunner.js",import.meta.url),"utf8");
 assert.doesNotMatch(runner,/createOrderV2|payBalance|stripe\.paymentIntents|refunds\.create/);
 const timer=source.indexOf("runBackgroundChecks = async");
 assert.match(source.slice(timer,timer+4400),/cjTrackingRunner\.sweep/);
 assert.match(source.slice(timer,timer+4400),/cjAutoPreflightScheduler\.sweep/);
});

test("live CJ stock validation refuses wrong warehouse, VID or insufficient inventory",()=>{
 const stock={verified:true,available:true,vid:"VID-EXACT",origin:"CN",quantity:1};
 assert.equal(validateCjLiveWarehouseStock(stock,{vid:"VID-EXACT",origin:"CN"}).quantity,1);
 for(const next of [
  {...stock,quantity:0},{...stock,quantity:0.5},
  {...stock,verified:false},{...stock,available:false},
  {...stock,vid:"ANOTHER"},{...stock,origin:"US"},{...stock,quantity:null},
 ]) assert.throws(()=>validateCjLiveWarehouseStock(next,{vid:"VID-EXACT",origin:"CN"}),/bloqueada/);
 assert.throws(()=>validateCjLiveWarehouseStock(stock,{vid:"VID-EXACT",origin:"US"}),/bloqueada/);
});

test("manual CJ create checks stock and quotes before an external createOrderV2 request",()=>{
 const source=readFileSync(new URL("./server.js",import.meta.url),"utf8");
 const check=source.slice(
  source.indexOf("async function verifyCjManualLiveCosts("),
  source.indexOf("async function verifyCjCustomerFunding("),
 );
 assert.match(check,/queryCjVariantStock/);
 assert.match(check,/validateCjLiveSupplyEvidence/);
 assert.match(check,/queryCjFactorySupply/);
 assert.match(check,/origin:"CN"/);
 assert.ok(check.indexOf("queryCjVariantStock")<check.indexOf("validateCjLiveSupplyEvidence"));
 const create=source.slice(
  source.indexOf('app.post("/api/admin/supplier-fulfillments/:id/cj-create-unpaid"'),
  source.indexOf('app.post("/api/admin/supplier-fulfillments/:id/cj-pay"'),
 );
 assert.ok(create.indexOf("verifyCjManualLiveCosts")>0);
 assert.ok(create.indexOf("verifyCjManualLiveCosts")<create.indexOf('cjRequest("/shopping/order/createOrderV2"'));
});
