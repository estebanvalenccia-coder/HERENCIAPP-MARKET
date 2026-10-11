import test from "node:test";
import assert from "node:assert/strict";
import {runCjAccountHealthProbe,parseCjAccountHealth,CJ_ACCOUNT_HEALTH_KEY} from "./cjConnectionHealth.js";
test("read-only probe calls only account and balance GET checks; never persists secrets",async()=>{
 const called=[],writes=[];
 const result=await runCjAccountHealthProbe({
   request:async path=>{called.push(path);return {result:true,data:{accessToken:"TOP_SECRET",balance:4000,openEmail:"hidden@example.com"}};},
   write:async(key,value)=>writes.push([key,value]),
   now:()=>new Date().toISOString(),
   pause:async()=>{},
 });
 assert.deepEqual(called,["/setting/get","/shopping/pay/getBalance"]);
 assert.equal(result.status,"verified");
 assert.equal(result.createsOrders,false);
 assert.equal(result.paysOrders,false);
 assert.equal(result.canAutomatePurchases,false);
 assert.equal(writes[0][0],CJ_ACCOUNT_HEALTH_KEY);
 assert.doesNotMatch(writes[0][1],/TOP_SECRET|hidden@example|4000/);
 assert.equal(parseCjAccountHealth(writes[0][1]).status,"verified");
});
test("CJ checks are sequential and spaced to respect provider QPS limits",async()=>{
 const events=[];
 const result=await runCjAccountHealthProbe({
   request:async endpoint=>{events.push(endpoint);return {result:true};},
   pause:async()=>{events.push("pause");},
   write:async()=>{},
 });
 assert.deepEqual(events,["/setting/get","pause","/shopping/pay/getBalance"]);
 assert.equal(result.status,"verified");
});

test("one failed GET does not falsely certify CJ",async()=>{
 const result=await runCjAccountHealthProbe({
   request:async path=>{
     if(path==="/setting/get")throw Object.assign(new Error("Do not leak key"),{providerCode:"CJ_NOT_AUTHORIZED"});
     return {result:true};
   },write:async()=>{},pause:async()=>{}
 });
 assert.equal(result.status,"partial");
 assert.equal(result.apiKeyAccepted,true);
 assert.equal(result.failureCodes[0].code,"CJ_NOT_AUTHORIZED");
});
test("bad stored records fail closed",()=>{
 assert.equal(parseCjAccountHealth(null),null);
 assert.equal(parseCjAccountHealth("{}"),null);
 assert.equal(parseCjAccountHealth('{"provider":"cj","status":"verified","checkedAt":"2020-01-01T00:00:00.000Z"}').status,"stale");
});
