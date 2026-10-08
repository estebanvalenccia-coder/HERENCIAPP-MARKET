// 1,000 offline, deterministic payment-policy scenarios. No network calls, real charges, orders or DB writes.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCjCheckout } from "./cjCheckoutSafety.js";
import { estimateCjProfitability } from "./cjProfitability.js";
import { calculateCouponDiscount, validateCouponRule, claimCouponUse, settleCouponUse } from "./promoCodes.js";

const realCJ = { id:"cj", price:20, metadata: { sourceHost:"cjdropshipping.com", fulfillmentType:"dropship", supplierId:"supplier", supplierVariantId:"1531107375489495040", cjPreferredLogisticName:"CJPacket", sourceProductUrl:"https://cjdropshipping.com/product-p-12345678-1234-1234-1234-123456789abc.html" } };
const supplier={id:"supplier",active:true,integrationType:"cj"};
const cases=200;

// 200 normal-plant scenarios: CJ must never intercept checkout for a local plant.
for(let i=0;i<cases;i++){
  test(`plant checkout ${i+1}/200 stays on local flow`,async()=>{
    const id=`plant-${i}`;
    const v=await evaluateCjCheckout({lines:[{id,price:5+i/10,quantity:1+i%5}],catalog:[{id,name:"Plant",price:5+i/10,category:"plantas"}],shippingAddress:{country:"ES",postalCode:"08001"}});
    assert.equal(v.cjOnly,false);
  });
}

// 200 percentage discount scenarios: preserve EUR cents and prevent discounts > subtotal.
for(let i=0;i<cases;i++){
  test(`standard coupon ${i+1}/200 correctly calculates cents`,()=>{
    const price=10+(i%75);
    const percent=1+(i%99);
    const code=`PROMO${i}`;
    const got=calculateCouponDiscount({code,rules:[{code,value:percent,type:"percent",scope:"all",active:true}],items:[{type:"product",category:"plantas",price,quantity:2}]});
    const expected=Math.round((price*2*percent/100)*100)/100;
    assert.equal(got.discount,expected);
    assert.ok(got.discount<=got.eligibleSubtotal);
  });
}

// 200 free-item promotions: a 100% product discount is exactly the product subtotal.
// These tests do NOT authorize free CJ fulfillment or assume free supplier freight.
for(let i=0;i<cases;i++){
  test(`100pct product coupon ${i+1}/200 never over-discounts`,()=>{
    const price=1+i/10;
    const code=`FREE${i}`;
    const got=calculateCouponDiscount({code,rules:[{code,value:100,type:"percent",scope:"products",active:true}],items:[{type:"product",price,quantity:1},{type:"service",serviceBooking:true,price:30,quantity:1}]});
    assert.equal(got.discount,Math.round(price*100)/100);
    assert.equal(got.eligibleSubtotal,Math.round(price*100)/100);
  });
}

// 200 CJ safety scenarios: invalid postal/destination/quantity is rejected before supplier network activity.
for(let i=0;i<cases;i++){
  test(`CJ fail-closed ${i+1}/200 rejects invalid checkout before payment`,async()=>{
    const variant=i%4;
    const shippingAddress=variant===0?{country:"US",postalCode:"10001"}:variant===1?{country:"ES",postalCode:""}:{country:"ES",postalCode:"08001"};
    const quantity=variant>=2?2:1;
    await assert.rejects(
      evaluateCjCheckout({lines:[{id:"cj",price:20,quantity}],catalog:[realCJ],suppliers:[supplier],shippingAddress}),
      (error)=>error?.statusCode===409
    );
  });
}

// 200 CJ cost scenarios: unsafe supplier costs or 100%-discount-equivalent zero revenue never become feasible.
for(let i=0;i<cases;i++){
  test(`CJ cost protection ${i+1}/200 prevents unprofitable or free supplier order`,()=>{
    const estimate=estimateCjProfitability({salePriceEur:i%2===0?0:8,productUsd:10+i/100,postageUsd:4,usdEurRate:0.9,vatRate:21,minMarginPercent:30});
    assert.equal(estimate.available,true);
    assert.equal(estimate.feasible,false);
    assert.ok(estimate.recommendedMinimumPriceEur>8);
  });
}

// Additional checks are static/simulation-only, not Stripe Test Mode integration.
test("coupon claim/redeem retries cannot use the same order twice",()=>{
  const rule=validateCouponRule({code:"SAFE100",value:100,type:"percent",active:true,maxUses:1});
  const first=claimCouponUse({},rule,"order-demo");
  assert.deepEqual(claimCouponUse(first,rule,"order-demo"),first);
  const paid=settleCouponUse(first,rule.code,"order-demo","redeem");
  assert.throws(()=>claimCouponUse(paid,rule,"another-order"),/límite de usos/);
});
