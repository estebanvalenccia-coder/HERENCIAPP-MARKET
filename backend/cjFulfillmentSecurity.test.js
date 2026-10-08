import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const server = readFileSync(new URL("./server.js", import.meta.url), "utf8");

test("Stripe payment confirmation queues supplier fulfillment without executing purchases", () => {
  const start=server.indexOf('if (event.type === "payment_intent.succeeded")');
  const end=server.indexOf('if (["payment_intent.payment_failed"',start);
  assert.ok(start>0 && end>start);
  const paymentHandler=server.slice(start,end);
  assert.match(paymentHandler,/buildSupplierFulfillmentsForOrder\(inventoryOrder\)/);
  assert.doesNotMatch(paymentHandler,/executeSupplierFulfillment\(/);
});
test("CJ order creation has a prior hard sandbox exit and live order creation gate", () => {
  const start=server.indexOf("async function executeCjSupplierFulfillment(");
  const end=server.indexOf("async function buildSupplierFulfillmentsForOrder(",start);
  assert.ok(start>0 && end>start);
  const functionSource=server.slice(start,end);
  const sandboxExit=functionSource.indexOf("if (sandbox) {");
  const liveGate=functionSource.indexOf("CJ_LIVE_ORDER_CREATION_ENABLED");
  const createOrder=functionSource.indexOf('"/shopping/order/createOrderV2"');
  assert.ok(sandboxExit>0 && liveGate>0 && createOrder>0);
  assert.ok(sandboxExit<createOrder && liveGate<createOrder);
});
test("CJ pricing requires a recent matching quote before queue auto-readiness", () => {
  assert.match(server,/quoteVerified\s*=\s*isCj/);
  assert.match(server,/Date\.now\(\) - quoteTimestamp < 24/);
  assert.match(server,/record\.items\s*\|\|\s*\[\]\)\.some\(\(item\) => !item\.cjPricingEstimate\?\.feasible/);
});

test("free-coupon checkout queues supplier fulfillment for review without CJ purchases", () => {
  const checkoutStart = server.indexOf('app.post("/api/stripe/create-payment-intent"');
  const freeStart = server.indexOf("    if (totalCents === 0) {\n      try {", checkoutStart);
  const stripeIntentStart = server.indexOf("      const paymentIntentParams = {", freeStart);
  assert.ok(checkoutStart > 0 && freeStart > checkoutStart && stripeIntentStart > freeStart);
  const freeFlow = server.slice(freeStart, stripeIntentStart);
  assert.match(freeFlow, /const paidOrder = await patchOrderPrimary\(orderId, \{ status: "paid" \}\);/);
  assert.match(freeFlow, /buildSupplierFulfillmentsForOrder\(paidOrder\)/);
  assert.match(freeFlow, /supplier_fulfillment_error/);
  assert.doesNotMatch(freeFlow, /executeSupplierFulfillment\(/);
  assert.doesNotMatch(freeFlow, /executeCjSupplierFulfillment\(/);
});
