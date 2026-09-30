import test from "node:test";
import assert from "node:assert/strict";
import { deliveryRules, validateDeliverySchedule } from "./deliveryCapacity.js";

test("delivery rules normalize capacity and cutoff", () => {
  const rules = deliveryRules({ deliverySlotCapacity: 9, sameDayCutoffHour: 16, deliveryClosedWeekdays: [0, 2, 2] });
  assert.equal(rules.capacity, 9);
  assert.equal(rules.cutoffHour, 16);
  assert.deepEqual(rules.closedWeekdays, [0, 2]);
});

test("past dates are rejected", () => {
  assert.throws(
    () => validateDeliverySchedule({
      requestedDate: "2026-09-29",
      requestedTimeSlot: "12:00-15:00",
      settings: { deliveryClosedWeekdays: [] },
      now: new Date("2026-09-30T10:00:00Z"),
    }),
    /fecha pasada/i
  );
});

test("closed weekdays are rejected", () => {
  assert.throws(
    () => validateDeliverySchedule({
      requestedDate: "2026-10-04",
      requestedTimeSlot: "12:00-15:00",
      settings: { deliveryClosedWeekdays: [0] },
      now: new Date("2026-09-30T10:00:00Z"),
    }),
    /no hay reparto/i
  );
});
