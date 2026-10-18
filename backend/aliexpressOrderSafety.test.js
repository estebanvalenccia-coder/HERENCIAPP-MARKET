import test from "node:test";
import assert from "node:assert/strict";
import { assessAliExpressOrderReadiness } from "./aliexpressOrderSafety.js";

const now=Date.parse("2026-10-18T21:00:00Z");
const input={
  orderId:"order-1",
  payment:{providerVerified:true,status:"succeeded",providerTransactionId:"pi_verified"},
  mapping:{verified:true,productId:"1005001234567890",skuAttr:"14:700"},
  quantity:1,
  address:{country:"ES",postalCode:"08001",city:"Barcelona",street:"Gran Via 10",recipient:"Buyer",phone:"+34600000000"},
  quote:{providerVerified:true,shippingVerified:true,destination:"ES",shippingService:"AliExpress Standard",checkedAt:"2026-10-18T20:58:00Z",productCostEur:8,shippingCostEur:2,taxesEur:2,otherCostsEur:1},
  salePriceEur:30,
};
const policy={
  authorized:true,providerOrderApiVerified:true,paymentArrangementVerified:true,
  customerPrivacyNoticeApproved:true,maxSupplierSpendEur:20,
  remainingDailyBudgetEur:30,minimumMarginPercent:25,
};
test("Readiness preflight never enables provider order creation or payment",()=>{
  const result=assessAliExpressOrderReadiness(input,policy,now);
  assert.equal(result.eligible,true);
  assert.equal(result.canCreateSupplierOrder,false);
  assert.equal(result.canChargeSupplier,false);
  assert.equal(result.estimatedCostEur,13);
});
test("A missing verified customer payment is always rejected",()=>{
  const result=assessAliExpressOrderReadiness({...input,payment:{status:"pending"}},policy,now);
  assert.equal(result.eligible,false);
  assert.ok(result.issues.includes("payment_not_verified"));
});
test("No provider authorization and unknown order submission block automated purchases",()=>{
  const result=assessAliExpressOrderReadiness({...input,externalOrderStatus:"unknown"},{...policy,merchantAuthorization:false,authorized:false},now);
  assert.equal(result.eligible,false);
  assert.ok(result.issues.includes("merchant_authorization_required"));
  assert.ok(result.issues.includes("duplicate_or_ambiguous_submission"));
});
test("Stale quotes, insufficient profit, and incomplete shipping block purchases",()=>{
  const unsafe={...input,
    address:{...input.address,phone:""},
    quote:{...input.quote,checkedAt:"2026-10-18T20:40:00Z",shippingCostEur:25},
  };
  const result=assessAliExpressOrderReadiness(unsafe,policy,now);
  assert.equal(result.eligible,false);
  assert.ok(result.issues.includes("address_incomplete"));
  assert.ok(result.issues.includes("verified_quote_missing"));
  assert.ok(result.issues.includes("supplier_budget_or_margin_failed"));
});
