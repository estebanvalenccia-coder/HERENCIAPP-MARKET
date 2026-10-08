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

test("Supplier Hub persists CJ EUR quotation from either shipping save button", () => {
  const ui = readFileSync(new URL("../src/app/components/admin/AdminSuppliersPanel.tsx", import.meta.url), "utf8");
  const saveQuoteCalls = ui.match(/onSave\(product, supplierId, mode, cost, supplierVariantId, supplierSku, selectedFreightName, quoteForSave\)/g) || [];
  assert.equal(saveQuoteCalls.length, 2, "both shipping save buttons must keep the selected freight quotation");
  assert.match(ui, /prepareSupplierFulfillments\(String\(order\.id\), true\)/);
});

test("Refreshing CJ supplier quote never recreates already submitted orders", () => {
  const start = server.indexOf("async function buildSupplierFulfillmentsForOrder(");
  const end = server.indexOf("async function executeSupplierFulfillment(", start);
  assert.ok(start > 0 && end > start);
  const source = server.slice(start, end);
  assert.match(source, /preserveSupplierFulfillment\(found,/);
  assert.match(source, /mergePreparedSupplierFulfillments\(/);
  assert.match(source, /mutateNeonStorageValue\("posOperations"/);
  assert.match(source, /quoteVerified\s*=\s*isCj/);
});

test("CJ manual approval is a successful preflight when price and shipping are verified", () => {
  const preflightStart = server.indexOf('app.post("/api/admin/supplier-fulfillments/cj-preflight"');
  const preflightEnd = server.indexOf('app.post("/api/admin/supplier-fulfillments/prepare', preflightStart);
  assert.ok(preflightStart > 0 && preflightEnd > preflightStart);
  const preflight = server.slice(preflightStart, preflightEnd);
  assert.match(preflight, /approvalExpected/);
  assert.match(preflight, /simulated\?\.status !== "autopilot_ready" && !approvalExpected/);
  assert.match(preflight, /simulationOnly: true/);
});

test("CJ account inspection calls the read-only order listing API and never purchases", () => {
  const start = server.indexOf('app.get("/api/admin/suppliers/cj/order-audit", requireAdmin');
  const end = server.indexOf('app.post("/api/admin/supplier-fulfillments/:id/sync", requireAdmin', start);
  assert.ok(start > 0 && end > start);
  const audit = server.slice(start, end);
  assert.match(audit, /CJ_AUDIT_ORDER_STATUSES/);
  assert.match(audit, /cjRequest\("\/shopping\/order\/list"/);
  assert.match(audit, /status \}/);
  assert.match(audit, /summarizeCjAccountOrders/);
  assert.doesNotMatch(audit, /cjPayOrder\(|createOrderV2|executeCjSupplierFulfillment\(/);
});

test("CJ forced payments honor the supplier cap and previously ordered records are idempotent", () => {
  const cjStart = server.indexOf("async function executeCjSupplierFulfillment(");
  const cjEnd = server.indexOf("async function syncCjSupplierFulfillment(", cjStart);
  assert.ok(cjStart > 0 && cjEnd > cjStart);
  const cj = server.slice(cjStart, cjEnd);
  assert.match(cj, /maxConfiguredPaymentUsd/);
  assert.match(cj, /projectedPaymentUsd > maxConfiguredPaymentUsd/);
  assert.match(cj, /actualPaymentUsd > maxPaymentUsd/);
  assert.doesNotMatch(cj, /!force && !sandbox && maxPaymentUsd > 0/);
  const repay = cj.indexOf("verifiedPaymentUsd > maxPaymentUsd");
  const repayCall = cj.indexOf("await cjPayOrder(", repay);
  assert.ok(repay > 0 && repayCall > repay, "repayment must check cap before CJ balance charge");
  const actualCheck = cj.indexOf("actualPaymentUsd > maxPaymentUsd");
  const actualPay = cj.lastIndexOf("await cjPayOrder(");
  assert.ok(actualCheck > 0 && actualPay > actualCheck, "first CJ balance payment must check cap");
  const supplierStart = server.indexOf("async function executeSupplierFulfillment(");
  const supplierEnd = server.indexOf("async function syncCjSupplierFulfillment(", supplierStart);
  const supplier = server.slice(supplierStart, supplierEnd);
  assert.match(supplier, /"ordered", "shipped", "delivered"/);
  assert.match(supplier, /return \{ fulfillment: record, executed: false, manual: false \}/);
});

test("legacy supplier execution never creates or pays CJ despite force=true", () => {
  const start = server.indexOf("async function executeSupplierFulfillment(");
  const end = server.indexOf("app.post(\"/api/admin/supplier-fulfillments/:id/execute\"",start);
  assert.ok(start > 0 && end > start);
  const source = server.slice(start,end);
  assert.match(source, /supplierIntegrationType\(supplier\) === "cj"/);
  assert.match(source, /return \{\s*fulfillment: \{\s*\.\.\.record,\s*blocker: "Revisa CJ/);
});

test("CJ manual create endpoint is separate from CJ payment and never calls balance payment", () => {
  const start=server.indexOf('app.post("/api/admin/supplier-fulfillments/:id/cj-create-unpaid", requireAdmin');
  const end=server.indexOf('app.post("/api/admin/supplier-fulfillments/:id/cj-pay", requireAdmin',start);
  assert.ok(start > 0 && end > start);
  const creation=server.slice(start,end);
  assert.match(creation,/CJ_LIVE_ORDER_CREATION_ENABLED/);
  assert.match(creation,/validateManualCjCreate/);
  assert.match(creation,/verifyCjCustomerFunding/);
  assert.match(creation,/mutateCjManualRecord/);
  assert.match(creation,/payType: 3/);
  assert.match(creation,/cj_creation_unknown/);
  assert.doesNotMatch(creation,/cjPayOrder\(|payBalance\(|payBalanceV2/);
});

test("CJ balance charge is in second route with merchant confirmation, caps and reservation", () => {
  const start=server.indexOf('app.post("/api/admin/supplier-fulfillments/:id/cj-pay", requireAdmin');
  const end=server.indexOf('app.post("/api/admin/supplier-fulfillments/:id/execute", requireAdmin',start);
  assert.ok(start > 0 && end > start);
  const payment=server.slice(start,end);
  assert.match(server,/CJ_LIVE_PAYMENT_ENABLED/);
  assert.match(payment,/cjManualReadyForPayment/);
  assert.match(payment,/validateManualCjPayment/);
  assert.match(payment,/verifyCjCustomerFunding/);
  assert.match(payment,/cjConfirmation\("pay"/);
  assert.match(payment,/cj_paying/);
  assert.match(payment,/cj_payment_unknown/);
  assert.match(payment,/await cjPayOrder\(/);
  assert.doesNotMatch(payment,/cjRequest\("\/shopping\/order\/createOrderV2"/);
});

test("CJ non-repeatable external action ledger is reserved before outbound orders and balance payments", () => {
  const createStart=server.indexOf('app.post("/api/admin/supplier-fulfillments/:id/cj-create-unpaid", requireAdmin');
  const paymentStart=server.indexOf('app.post("/api/admin/supplier-fulfillments/:id/cj-pay", requireAdmin',createStart);
  const reconcileStart=server.indexOf('app.post("/api/admin/supplier-fulfillments/:id/cj-reconcile", requireAdmin',paymentStart);
  const create=server.slice(createStart,paymentStart);
  const payment=server.slice(paymentStart,reconcileStart);
  assert.ok(create.indexOf('claimCjExternalAction("create"') > 0);
  assert.ok(create.indexOf('claimCjExternalAction("create"') < create.indexOf('cjRequest("/shopping/order/createOrderV2"'));
  assert.ok(payment.indexOf('claimCjExternalAction("pay"') > 0);
  assert.ok(payment.indexOf('claimCjExternalAction("pay"') < payment.indexOf('await cjPayOrder('));
  assert.match(server,/cjManualExternalAction:/);
});

test("CJ reconciliation only reads supplier orders; never retries unknown charge or creation", () => {
  const start=server.indexOf('app.post("/api/admin/supplier-fulfillments/:id/cj-reconcile", requireAdmin');
  const end=server.indexOf('app.post("/api/admin/supplier-fulfillments/:id/execute", requireAdmin',start);
  assert.ok(start>0&&end>start);
  const reconcile=server.slice(start,end);
  assert.match(reconcile,/safeToRetryCreate: false/);
  assert.match(reconcile,/CJ_AUDIT_ORDER_STATUSES/);
  assert.match(reconcile,/"/shopping\/order\/list"/);
  assert.match(reconcile,/"/shopping\/order\/getOrderDetail"/);
  assert.doesNotMatch(reconcile,/cjPayOrder\(|cjRequest\("/shopping\/order\/createOrderV2"/);
});

test("unknown CJ supplier statuses never count as ordered; admins cannot invent a CJ shipment", () => {
  const start=server.indexOf("async function syncCjSupplierFulfillment(");
  const end=server.indexOf("async function prepareCjDispute(",start);
  assert.ok(start>0&&end>start);
  const sync=server.slice(start,end);
  assert.match(sync,/"action_required"/);
  const edit=server.indexOf('app.patch("/api/admin/supplier-fulfillments/:id", requireAdmin');
  assert.ok(edit>0);
  assert.match(server.slice(edit,edit+1800),/Los estados, pagos, referencias y tracking CJ solo se actualizan mediante la verificación del proveedor/);
});
