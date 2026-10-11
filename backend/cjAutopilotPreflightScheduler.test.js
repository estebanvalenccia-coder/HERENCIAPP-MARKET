import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {cjPreflightCandidates,cjPreflightKey,readCjPreflightCache,
  createCjPreflightScheduler} from "./cjAutopilotPreflightScheduler.js";

const NOW=Date.parse("2026-10-11T18:00:00Z");
const row={id:"f1",status:"approval_required",supplierId:"cj",provider:"cj",orderId:"o1"};
const policy={configured:true,mode:"simulation",allowedSupplierIds:["cj"]};

test("only exact allowed CJ queue records can be automatically inspected",()=>{
 const result=cjPreflightCandidates([row,{...row,id:"f2",status:"cj_payment_unknown"},
   {...row,id:"f3",provider:"printful",supplierId:"other"},
   {...row,id:"f4",externalOrderId:"cj1"},row],["cj"]);
 assert.deepEqual(result.map(x=>x.id),["f1","f1"]);
 assert.deepEqual(cjPreflightCandidates([row],[]),[]);
});

test("one preflight per sweep, a live check does not authorize a purchase",async()=>{
 const kv=new Map(),calls=[];
 const api={
  load:async()=>({policy,records:[row]}),
  read:async key=>kv.get(key)||null,
  write:async(key,val)=>{kv.set(key,val);},
  mutate:async(key,fn)=>{kv.set(key,await fn(kv.get(key)||null));},
  check:async id=>{calls.push(id);return {eligibleForSupervisedTest:true,moneySpent:false};},
  now:()=>NOW
 };
 const worker=createCjPreflightScheduler(api);
 const first=await worker.sweep();
 assert.equal(first.status,"eligible");
 assert.equal(first.checked,1);
 assert.deepEqual(calls,["f1"]);
 const cache=readCjPreflightCache(kv.get(cjPreflightKey("f1")),{nowMs:NOW});
 assert.equal(cache.eligible,true);
 assert.equal(cache.sourceStatus,"approval_required");
 assert.equal(await worker.sweep().then(x=>x.checked),0);
 assert.deepEqual(calls,["f1"]);
});

test("provider failure caches unavailable and never repeats immediately",async()=>{
 const kv=new Map(),api={
  load:async()=>({policy,records:[row]}),
  read:async key=>kv.get(key)||null,
  write:async(key,val)=>kv.set(key,val),
  mutate:async(key,fn)=>kv.set(key,await fn(kv.get(key)||null)),
  check:async()=>{throw new Error("provider unavailable");},
  now:()=>NOW,
 };
 const x=createCjPreflightScheduler(api),first=await x.sweep();
 assert.equal(first.status,"unavailable");
 assert.equal(readCjPreflightCache(kv.get(cjPreflightKey("f1")),{nowMs:NOW}).eligible,false);
 assert.equal((await x.sweep()).status,"recently_checked");
});

test("lease prevents overlapping workers and no policy means no supplier call",async()=>{
 const kv=new Map();
 const options={
  load:async()=>({policy,records:[row]}),
  read:async key=>kv.get(key)||null,
  write:async(key,val)=>kv.set(key,val),
  mutate:async(key,fn)=>kv.set(key,await fn(kv.get(key)||null)),
  check:async()=>({eligibleForSupervisedTest:false}),
  now:()=>NOW,
 };
 const a=createCjPreflightScheduler({...options,load:async()=>({policy:{configured:false},records:[row]})});
 assert.equal((await a.sweep()).status,"no_policy");
 const b=createCjPreflightScheduler({...options,mutate:async(key,fn)=>kv.set(key,await fn(JSON.stringify({owner:"other",expiresAt:NOW+100000})) )});
 assert.equal((await b.sweep()).status,"another_worker");
});

test("automatic preflight uses existing Stripe+supplier read-only verifier and server-private keys",()=>{
 const server=readFileSync(new URL("./server.js",import.meta.url),"utf8");
 const security=readFileSync(new URL("./supplierInternalStorageSecurity.js",import.meta.url),"utf8");
 assert.match(server,/async function runCjAutopilotLivePreflight/);
 assert.match(server,/runCjAutopilotLivePreflight\(req.params.id\)/);
 assert.match(server,/check:runCjAutopilotLivePreflight/);
 assert.match(server,/CJ_READ_ONLY_PREFLIGHT_ENABLED/);
 assert.match(security,/cjautopilotpreflightcache:v1:/);
 assert.match(security,/cjautopilotpreflightlease:v1/);
 assert.match(security,/cjautopilotpreflightcursor:v1/);
});
