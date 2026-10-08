import test from "node:test";
import assert from "node:assert/strict";
import { estimateCjProfitability } from "./cjProfitability.js";

test("CJ pricing fails closed when FX or postage missing", () => {
  assert.equal(estimateCjProfitability({salePriceEur:20,productUsd:10.78,postageUsd:12.72}).available,false);
  assert.equal(estimateCjProfitability({salePriceEur:20,productUsd:10.78,usdEurRate:0.9}).available,false);
});
test("CJ quote includes full postage and VAT-adjusted proceeds", () => {
  const quote=estimateCjProfitability({salePriceEur:20,productUsd:10.78,shippingUsd:9.22,postageUsd:12.72,usdEurRate:0.9,vatRate:21,minMarginPercent:30});
  assert.equal(quote.supplierTotalUsd,23.5);
  assert.equal(quote.costEur,21.78);
  assert.equal(quote.feasible,false);
  assert.ok(quote.estimatedProfitEur<0);
  assert.ok(quote.recommendedMinimumPriceEur>20);
});
test("CJ quote can be profitable above the recommended minimum", () => {
  const quote=estimateCjProfitability({salePriceEur:65,productUsd:10.78,postageUsd:12.72,usdEurRate:0.9,vatRate:21,minMarginPercent:30});
  assert.equal(quote.available,true);
  assert.equal(quote.feasible,true);
});
test("CJ quote does not turn unknown postage into zero", () => {
  const quote=estimateCjProfitability({salePriceEur:50,productUsd:10,postageUsd:null,shippingUsd:null,usdEurRate:0.9});
  assert.equal(quote.available,false);
});
