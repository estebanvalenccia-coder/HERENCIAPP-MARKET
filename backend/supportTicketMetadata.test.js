import test from "node:test";
import assert from "node:assert/strict";
import { parseSupportTicketMetadata, SUPPORT_CATEGORIES, SUPPORT_PRIORITIES } from "./supportTicketMetadata.js";

test("all supported support ticket categories and priority values are accepted", () => {
  for (const priority of SUPPORT_PRIORITIES) {
    assert.deepEqual(parseSupportTicketMetadata({ priority }), { priority });
  }
  for (const category of SUPPORT_CATEGORIES) {
    assert.deepEqual(parseSupportTicketMetadata({ category }), { category });
  }
});
test("partial edits only change the specified support metadata", () => {
  assert.deepEqual(parseSupportTicketMetadata({ category: "products" }), { category: "products" });
  assert.deepEqual(parseSupportTicketMetadata({ priority: "urgent", category: "delivery" }), { priority: "urgent", category: "delivery" });
});
test("reject invalid priority, category and empty updates", () => {
  for (const payload of [{}, null, [], { priority: "administrator" }, { category: "<script>" }, { priority: false }]) {
    assert.throws(() => parseSupportTicketMetadata(payload), /válid|Prioridad|Categoría/i);
  }
});
test("unknown fields cannot overwrite message history, customer id or ticket status", () => {
  const data = parseSupportTicketMetadata({
    priority: "high",
    customerId: "another-customer",
    messages: [{ role: "agent", text: "spoofed" }],
    status: "resolved",
  });
  assert.deepEqual(data, { priority: "high" });
});
