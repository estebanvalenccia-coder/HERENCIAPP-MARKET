import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 CJ_POLICY_KEY, CJ_BUDGET_LEDGER_PREFIX,
 emptyCjAutopilotPolicy,readCjAutopilotPolicy,validateCjPolicyDraft,
 saveCjAutopilotPolicyDraft,reserveCjDailyBudget,readCjBudgetLedger,
 summarizeCjDailyExposure,assessCjAutopilotDryRun,
} from "./cjAutopilotPolicy.js";

const config={
  perOrderMaxEur:25,dailyMaxEur:100,minMarginPercent:25,
  country:"ES",quantity:1,allowedSupplierIds:["supplier-CJ"]
};
const nowMs=Date.parse("2026-10-11T10:08:00.000Z");
const saved=saveCjAutopilotPolicyDraft(config,["supplier-CJ"],new Date(nowMs).toISOString());
const policy=readCjAutopilotPolicy(saved);
const record={
  id:"fulfillment1",orderId:"herencia1",supplierId:"supplier-CJ",provider:"cj",
  status:"approval_required",externalOrderId:"",cjShipmentOrderId:"",
  shippingAddress:{country:"ES",postalCode:"28001"},
  items:[{quantity:1,supplierVariantId:"VID-1",supplierSku:"SKU-1",
    selectedVariant:"Rosa - EU",salePrice:40,cjPreferredLogisticName:"CJPacket"}]
};
const order={
  id:record.orderId,status:"paid",total:40,stripe_payment_intent_id:"pi_1234",metadata:{}
};
const stripe={
  id:"pi_1234",status:"succeeded",livemode:true,currency:"eur",amount_received:4000
};
const quote={
  available:true,vid:"VID-1",sku:"SKU-1",selectedVariant:"Rosa - EU",
  destination:"ES",postalCode:"28001",methodName:"CJPacket",salePriceEur:40,
  checkedAt:"2026-10-11T10:07:45.000Z",costEur:16,supplierTotalUsd:17,
  estimatedMarginPercent:31,feasible:true,
};
const stock={verified:true,available:true,quantity:8,vid:"VID-1",origin:"CN"};
const exposure={day:"2026-10-11",usedEur:0,unknownCount:0,verifiedCompletely:true};

test("new financial policy is blank and fails closed",()=>{
 assert.equal(emptyCjAutopilotPolicy().configured,false);
 assert.equal(emptyCjAutopilotPolicy().livePurchasesAllowed,false);
 assert.equal(readCjAutopilotPolicy("").perOrderMaxEur,null);
 assert.equal(readCjAutopilotPolicy('{"enabled":true}').configured,false);
 assert.equal(CJ_POLICY_KEY.startsWith("cjAutopilotGuardrails:"),true);
 assert.equal(CJ_BUDGET_LEDGER_PREFIX,"cjAutopilotBudget:");
});

test("limits persist per supplier only as simulation, without authorizing money",()=>{
 const p=readCjAutopilotPolicy(saved);
 assert.equal(p.configured,true);
 assert.equal(p.mode,"simulation");
 assert.equal(p.perOrderMaxEur,25);
 assert.equal(p.dailyMaxEur,100);
 assert.equal(p.minMarginPercent,25);
 assert.deepEqual(p.allowedSupplierIds,["supplier-CJ"]);
 assert.equal(p.livePaymentsAllowed,false);
 assert.equal(p.livePurchasesAllowed,false);
 assert.equal(p.requiresMerchantAuthorization,true);
});

test("invalid budgets, unknown suppliers, other countries, non-1 quantity and enablement cannot persist",()=>{
 const patches=[
  {perOrderMaxEur:0},{perOrderMaxEur:-10},{dailyMaxEur:15},
  {dailyMaxEur:"0.123"},{minMarginPercent:0},{minMarginPercent:90},
  {country:"FR"},{quantity:2},{allowedSupplierIds:[]},
  {allowedSupplierIds:["other"]},{allowedSupplierIds:["supplier-CJ","supplier-CJ"]},
  {livePurchasesAllowed:true},{livePaymentsAllowed:true},
  {autoPaymentEnabled:true},{mode:"live"},{enabled:true},
 ];
 for(const patch of patches){
  assert.throws(()=>saveCjAutopilotPolicyDraft({...config,...patch},["supplier-CJ"]),JSON.stringify(patch));
 }
});
test("daily budget reserves exact integer cents and tracks uncertainty without automatic debits",()=>{
 let raw="";
 const p=readCjAutopilotPolicy(saved);
 for(let i=0;i<4;i++){
   const res=reserveCjDailyBudget(raw,{policy:p,fulfillmentId:"fulfill-"+i,amountEur:24.99,
      date:"2026-10-11T10:01:00.000Z"});
   raw=res.ledger;
   assert.equal(res.canSpendRealMoney,false);
   assert.equal(res.dailyUsedCents,(i+1)*2499);
 }
 assert.throws(()=>reserveCjDailyBudget(raw,{policy:p,
  fulfillmentId:"fulfill-5",amountEur:25,date:"2026-10-11T13:01:00.000Z"}),/diario/);
 assert.throws(()=>reserveCjDailyBudget(raw,{policy:p,
  fulfillmentId:"fulfill-2",amountEur:1,date:"2026-10-11T13:01:00.000Z"}),/reserva/);
 const ledger=readCjBudgetLedger(raw,"2026-10-11T12:00:00.000Z");
 assert.equal(ledger.reservations.length,4);
 assert.throws(()=>readCjBudgetLedger(raw,"2026-10-12T01:00:00.000Z"));
});
test("pending CJ creation and unknown payment count against today's conservative exposure",()=>{
 const make=(id,status,cost,when="2026-10-11T09:00:00.000Z")=>({
  id,provider:"cj",status,cjCreatedAt:when,estimatedCost:cost
 });
 const data=[
  make("c1","cj_creating",10),make("c2","cj_creation_unknown",20),
  make("c3","ordered",30),make("c4","cj_payment_unknown",null),
  make("c5","approval_required",100),make("c6","shipped",80,"2026-10-10T11:00:00.000Z")
 ];
 const result=summarizeCjDailyExposure(data,{date:"2026-10-11T12:00:00.000Z"});
 assert.equal(result.usedEur,60);
 assert.equal(result.unknownCount,1);
 assert.equal(result.verifiedCompletely,false);
 assert.equal(result.obligationCount,4);
 const except=summarizeCjDailyExposure(data,{date:"2026-10-11T12:00:00.000Z",
  excludeFulfillmentId:"c4"});
 assert.equal(except.verifiedCompletely,true);
});
test("a fully verified dry-run can be eligible for supervised test, never unattended purchase",()=>{
 const out=assessCjAutopilotDryRun({
  policy,record,supplier:{id:"supplier-CJ",active:true,cjSandbox:false},
  order,stripeIntent:stripe,quote,stock,usdEurRate:.92,nowMs,dailyExposure:exposure,
 });
 assert.deepEqual(out.blockers,[]);
 assert.equal(out.eligibleForSupervisedTest,true);
 assert.equal(out.automaticPurchasesEnabled,false);
 assert.equal(out.automaticSupplierPaymentEnabled,false);
 assert.equal(out.moneySpent,false);
 assert.equal(out.supplierOrderCreated,false);
});
test("Stripe test-mode, mismatched payment ID, coupons, unknown stock, VAT regions and stale quote fail",()=>{
 const common={policy,record,supplier:{id:"supplier-CJ",active:true,cjSandbox:false},
  order,stripeIntent:stripe,quote,stock,usdEurRate:.92,nowMs,dailyExposure:exposure};
 for(const patch of [
  {stripeIntent:{...stripe,livemode:false}},
  {stripeIntent:{...stripe,id:"pi_other"}},
  {stripeIntent:{...stripe,amount_received:100}},
  {order:{...order,metadata:{discount:20}}},
  {stock:{...stock,vid:"other"}},
  {record:{...record,shippingAddress:{country:"ES",postalCode:"35002"}}},
  {record:{...record,status:"cj_payment_unknown"}},
  {record:{...record,externalOrderId:"cj123"}},
  {quote:{...quote,estimatedMarginPercent:15}},
  {quote:{...quote,checkedAt:"2026-10-10T09:00:00Z"}},
  {dailyExposure:{...exposure,unknownCount:1,verifiedCompletely:false}},
  {dailyExposure:{...exposure,usedEur:95}},
 ]){
  const result=assessCjAutopilotDryRun({...common,...patch});
  assert.equal(result.eligibleForSupervisedTest,false,JSON.stringify(patch));
  assert.equal(result.automaticPurchasesEnabled,false);
 }
});

test("all CJ autopilot policy endpoints enforce auth, never perform supplier creation, balance debit or refunds",()=>{
 const server=readFileSync(new URL("./server.js",import.meta.url),"utf8");
 const start=server.indexOf('app.get("/api/admin/suppliers/cj/autopilot-guardrails"');
 const end=server.indexOf("// CJ automation health is a status/preflight",start);
 assert.ok(start>0&&end>start);
 const section=server.slice(start,end);
 assert.match(section,/requireAdmin/);
 assert.match(section,/validateManualCjCreate/);
 assert.match(section,/verifyCjCustomerFunding/);
 assert.match(section,/verifyCjManualLiveCosts/);
 assert.match(section,/getUsdToEurRate/);
 assert.match(section,/summarizeCjDailyExposure/);
 assert.match(section,/modo simulación/);
 assert.doesNotMatch(section,/createOrderV2|cjPayOrder|stripe\\.refund|paymentIntents\\.create|payBalance/);
});
test("generic storage API blocks private policy and ledger keys",()=>{
 const guard=readFileSync(new URL("./supplierInternalStorageSecurity.js",import.meta.url),"utf8");
 assert.match(guard,/cjautopilotguardrails:/);
 assert.match(guard,/cjautopilotbudget:/);
});
