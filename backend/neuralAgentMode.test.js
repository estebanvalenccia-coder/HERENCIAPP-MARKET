import test from "node:test";
import assert from "node:assert/strict";
import { buildNeuralExecutionPlan } from "./neuralAgentMode.js";

test("Agent Mode permits configured automatic inventory action", () => {
  const plan = buildNeuralExecutionPlan({ intent: "inventory", steps: [{ action: "modify_stock", input: { productId: "demo", stock: 8 } }], policy: { autonomy: "RUNNING", permissions: { modify_stock: "AUTO" } } });
  assert.equal(plan.state, "READY");
  assert.equal(plan.steps[0].state, "READY");
});

test("Agent Mode requires approval for price changes", () => {
  const plan = buildNeuralExecutionPlan({ intent: "price", steps: [{ action: "change_prices", input: { productId: "demo", price: 29 } }], policy: { autonomy: "RUNNING", permissions: { change_prices: "ASK" } } });
  assert.equal(plan.state, "WAITING_APPROVAL");
});

test("Agent Mode blocks actions when autonomy is stopped", () => {
  const plan = buildNeuralExecutionPlan({ intent: "inventory", steps: [{ action: "modify_stock", input: { productId: "demo", stock: 2 } }], policy: { autonomy: "STOPPED", permissions: { modify_stock: "AUTO" } } });
  assert.equal(plan.state, "BLOCKED");
});
