import test from "node:test";
import assert from "node:assert/strict";
import {
  printfulLivePolicy,assessPrintfulAutoConfirm,printfulAutoConfirmOrderCandidate,printfulDailyBudgetKey,
  normalizePrintfulTracking,
} from "./printfulLivePolicy.js";
const mandate=printfulLivePolicy({
  PRINTFUL_AUTO_CONFIRM_ENABLED:"true",
  PRINTFUL_MAX_ORDER_COST_EUR:"30",
  PRINTFUL_MAX_DAILY_SPEND_EUR:"50",
  PRINTFUL_MIN_NET_MARGIN_PCT:"25",
});
const now=Date.parse("2026-10-12T12:00:00Z");
const order={status:"paid",stripe_payment_intent_id:"pi_123",total:70};
const quote={currency:"EUR",total:25,checkedAt:new Date(now).toISOString()};
test("financial mandate needs explicit per-order, daily and margin limits",()=>{
 assert.equal(printfulLivePolicy({}).enabled,false);
 assert.equal(printfulLivePolicy({PRINTFUL_AUTO_CONFIRM_ENABLED:"true"}).enabled,false);
 assert.equal(printfulLivePolicy({
   PRINTFUL_AUTO_CONFIRM_ENABLED:"true",PRINTFUL_MAX_ORDER_COST_EUR:"30",
   PRINTFUL_MAX_DAILY_SPEND_EUR:"50",PRINTFUL_MIN_NET_MARGIN_PCT:"0"
 }).enabled,false);
 assert.equal(mandate.enabled,true);
 assert.equal(printfulDailyBudgetKey(now),"printfulLiveBudget:v1:2026-10-12");
});
test("only settled positive-margin EUR orders can authorize supplier charges",()=>{
 assert.equal(assessPrintfulAutoConfirm({order,estimate:quote,policy:mandate,now}).allowed,true);
 for(const status of ["pending","draft","payment_error"])
   assert.equal(assessPrintfulAutoConfirm({order:{...order,status},estimate:quote,policy:mandate,now}).allowed,false);
 assert.equal(assessPrintfulAutoConfirm({order:{...order,total:0},estimate:quote,policy:mandate,now}).allowed,false);
 assert.equal(assessPrintfulAutoConfirm({order:{...order,stripe_payment_intent_id:""},estimate:quote,policy:mandate,now}).allowed,false);
 assert.equal(assessPrintfulAutoConfirm({order,estimate:{...quote,currency:"USD"},policy:mandate,now}).allowed,false);
 assert.equal(assessPrintfulAutoConfirm({order,estimate:{...quote,total:31},policy:mandate,now}).allowed,false);
 assert.equal(assessPrintfulAutoConfirm({order,estimate:{...quote,total:50},policy:mandate,now}).allowed,false);
 assert.equal(assessPrintfulAutoConfirm({order,estimate:{...quote,checkedAt:new Date(now-11*60*1000).toISOString()},policy:mandate,now}).allowed,false);
 assert.equal(assessPrintfulAutoConfirm({order,estimate:quote,policy:printfulLivePolicy({}),now}).allowed,false);
});
test("local Printful preflight blocks coupon-funded and unverified Stripe orders without supplier calls",()=>{
 const ok=printfulAutoConfirmOrderCandidate(order);
 assert.equal(ok.eligible,true);
 for(const unsafe of [
  {...order,status:"confirmed"},
  {...order,stripe_payment_intent_id:""},
  {...order,total:0},
  {...order,total:-1},
  {...order,total:"not-a-number"},
  {status:"paid",total:0,payment_method:"coupon"},
 ])assert.equal(printfulAutoConfirmOrderCandidate(unsafe).eligible,false);
 assert.equal(printfulAutoConfirmOrderCandidate({...order,total:0}).reason,
  "positive_paid_total_and_supplier_cost_required");
 assert.equal(printfulAutoConfirmOrderCandidate({...order,stripe_payment_intent_id:""}).reason,
  "stripe_paid_order_required");
});
test("tracking normalization ignores unsafe links and keeps signed supplier data bounded",()=>{
 const result=normalizePrintfulTracking({
  id:987,status:"fulfilled",
  shipments:[{trackingNumber:"ABC123",trackingUrl:"https://carrier.test/track",status:"shipped"},
    {trackingNumber:"BAD",trackingUrl:"javascript:alert(1)"}],
 });
 assert.equal(result.hasTracking,true);
 assert.equal(result.shipments[0].trackingNumber,"ABC123");
 assert.equal(result.shipments[1].trackingUrl,"");
});
