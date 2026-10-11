import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  reserveCjDailyBudget,settleCjBudgetReservation,
  summarizeCjBudgetLedger,readCjBudgetLedger,
} from "./cjAutopilotPolicy.js";
const policy={
  configured:true,mode:"simulation",
  livePurchasesAllowed:false,livePaymentsAllowed:false,
  perOrderMaxEur:25,dailyMaxEur:50,
};
const date="2026-10-11T18:00:00Z";
const claim=(raw,id,amount)=>reserveCjDailyBudget(raw,{
  policy,fulfillmentId:id,amountEur:amount,date,
}).ledger;
const settle=(raw,id,status,other={})=>settleCjBudgetReservation(raw,{
  fulfillmentId:id,status,date,...other,
});

test("budget allocation uses precise cents and counts uncertain payments",()=>{
  let raw=claim(null,"order-1",12.35);
  raw=claim(raw,"order-2",20.01);
  let total=summarizeCjBudgetLedger(raw,{policy,date});
  assert.equal(total.exposureEur,32.36);
  assert.equal(total.remainingEur,17.64);
  assert.equal(total.canSpendRealMoney,false);
  assert.throws(()=>claim(raw,"order-1",3),/reserva/);
  assert.throws(()=>claim(raw,"order-3",20),/límite diario/);
  raw=settle(raw,"order-1","uncertain").ledger;
  total=summarizeCjBudgetLedger(raw,{policy,date});
  assert.equal(total.uncertainEur,12.35);
  assert.equal(total.remainingEur,17.64);
  assert.throws(()=>settle(raw,"order-1","released",{remoteActionAttempted:false}),/No se puede liberar/);
});

test("a remote action can never be released without external reconciliation",()=>{
  const raw=claim(null,"order-1",20);
  assert.throws(()=>settle(raw,"order-1","released"),/liberar/);
  assert.throws(()=>settle(raw,"order-1","committed"),/no ha confirmado/);
  assert.equal(settle(raw,"order-1","uncertain").status,"uncertain");
  const uncertain=settle(raw,"order-1","uncertain").ledger;
  assert.equal(settle(uncertain,"order-1","uncertain",{providerEvidence:false}).idempotent,true);
  const finished=settle(uncertain,"order-1","committed",{providerEvidence:true});
  assert.equal(readCjBudgetLedger(finished.ledger,date).reservations[0].status,"committed");
  assert.throws(()=>settle(finished.ledger,"order-1","released",{remoteActionAttempted:false}),/liberar/);
});

test("no remote attempted means released funds but tombstone prevents duplicate order",()=>{
  const reserved=claim(null,"order-1",20);
  const released=settle(reserved,"order-1","released",{remoteActionAttempted:false}).ledger;
  const totals=summarizeCjBudgetLedger(released,{policy,date});
  assert.equal(totals.exposureEur,0);
  assert.equal(totals.remainingEur,50);
  assert.throws(()=>claim(released,"order-1",20),/reserva/);
  assert.equal(settle(released,"order-1","released",{remoteActionAttempted:false}).idempotent,true);
  assert.throws(()=>settle(released,"order-1","uncertain"),/no admite/);
});

test("any damaged financial ledger blocks, never silently resets",()=>{
  assert.throws(()=>summarizeCjBudgetLedger("broken",{policy,date}),/interpretar/);
  assert.throws(()=>settle(null,"missing","uncertain"),/No existe/);
  assert.throws(()=>settle(claim(null,"id",1),"id","released",{remoteActionAttempted:true}),/liberar/);
});

test("the admin summary reads plan and ledger without any payment or creation",()=>{
  const server=readFileSync(new URL("./server.js",import.meta.url),"utf8");
  const start=server.indexOf('app.get("/api/admin/suppliers/cj/automation-readiness"');
  const end=server.indexOf("// Automatically detect critical ambiguous CJ actions.",start);
  assert.ok(start>0&&end>start);
  const route=server.slice(start,end);
  assert.match(route,/summarizeCjAutopilotPlans/);
  assert.match(route,/summarizeCjBudgetLedger/);
  assert.match(route,/readCjPreflightCache/);
  assert.doesNotMatch(route,/createOrderV2|cjPayOrder|payBalance|refunds\.create|mutateNeonStorageValue/);
});
