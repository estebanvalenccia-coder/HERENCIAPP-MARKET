import test from "node:test";
import assert from "node:assert/strict";
import { CJ_AUDIT_ORDER_STATUSES, summarizeCjAccountOrders } from "./cjOrderAudit.js";

const fulfillment = {
  id: "local-cj-1", orderId: "987de497-c30c-4ee7-8cdf-faf7355c8b3b",
  status: "approval_required", estimatedCost: 21.64, externalOrderId: "",
};

test("CJ account audit always asks for explicit order states", () => {
  assert.deepEqual(CJ_AUDIT_ORDER_STATUSES, [
    "CREATED", "IN_CART", "UNPAID", "UNSHIPPED", "SHIPPED", "DELIVERED", "CANCELLED"
  ]);
});

test("CJ account order matching keeps only Herencia refs and strips customer PII", () => {
  const page = {
    status: "UNPAID", total: 2,
    list: [
      {
        orderId: "CJ001",
        orderNum: "HM-" + fulfillment.orderId + "-26cdae3f",
        orderStatus: "UNPAID", orderAmount: 24.78,
        shippingAddress: "DO NOT EXPOSE",
        shippingPhone: "+34123456789", shippingCustomerName: "PRIVATE NAME",
      },
      { orderId: "OTHER002", orderNum: "OTHER-SHOP", shippingCustomerName: "PRIVATE NAME" },
    ],
  };
  const response = summarizeCjAccountOrders([page], [fulfillment]);
  assert.equal(response.cjOrders.length, 1);
  assert.equal(response.cjOrders[0].cjOrderId, "CJ001");
  assert.equal(response.cjOrders[0].localOrderId, fulfillment.orderId);
  assert.equal(response.localQueue[0].cjDetectedInPages, true);
  assert.equal(response.localQueue[0].cjOrderStatus, "UNPAID");
  assert.equal(response.incomplete, false);
  assert.doesNotMatch(JSON.stringify(response), /DO NOT EXPOSE|PRIVATE NAME|123456789/);
});

test("CJ audit does not confuse a missing first-page match with confirmed absence", () => {
  const page = { status: "UNPAID", total: 121, list: [] };
  const response = summarizeCjAccountOrders([page], [fulfillment]);
  assert.equal(response.incomplete, true);
  assert.equal(response.localQueue[0].cjDetectedInPages, false);
  assert.match(response.warning, /primera página/);
});

test("Orders created in CJ but missing from the local queue remain visible by HM reference", () => {
  const response = summarizeCjAccountOrders([
    { status: "CREATED", total: 1,
      list: [{ orderId: "CJ234", orderNum: "HM-some-new-order-unknown", orderStatus: "CREATED" }] }
  ], [fulfillment]);
  assert.equal(response.cjOrders.length, 1);
  assert.equal(response.cjOrders[0].localOrderId, null);
});

test("Duplicate CJ rows returned under overlapping statuses appear only once", () => {
  const row = { orderId: "CJ001", orderNum: "HM-" + fulfillment.orderId + "-26cdae3f", orderStatus: "PROCESSING" };
  const response = summarizeCjAccountOrders([
    { status: "PROCESSING", total: 1, list: [row] },
    { status: "UNSHIPPED", total: 1, list: [row] },
  ], [fulfillment]);
  assert.equal(response.cjOrders.length, 1);
});
