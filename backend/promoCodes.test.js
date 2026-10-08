import test from "node:test";
import assert from "node:assert/strict";
import { calculateCouponDiscount, claimCouponUse, settleCouponUse, madridDate } from "./promoCodes.js";

const product = { id: "plant", price: 20, quantity: 1 };
const service = { id: "garden", price: 30, quantity: 2, serviceBooking: true };
const rules = (overrides = {}) => [{ code: "HERENCIA100", type: "percent", value: 100, scope: "all", active: true, maxUses: 1, ...overrides }];

test("100% coupon covers products and services without discounting beyond subtotal", () => {
  const r = calculateCouponDiscount({ code: "herencia100", rules: rules(), items: [product, service] });
  assert.equal(r.discount, 80);
  assert.equal(r.eligibleSubtotal, 80);
  assert.equal(r.code, "HERENCIA100");
});

test("10% and 50% promotions respect scope", () => {
  const a = calculateCouponDiscount({ code: "HERENCIA100", rules: rules({ value: 10, scope: "products" }), items: [product, service] });
  const b = calculateCouponDiscount({ code: "HERENCIA100", rules: rules({ value: 50, scope: "services" }), items: [product, service] });
  assert.equal(a.discount, 2);
  assert.equal(b.discount, 30);
});

test("invalid, inactive, inapplicable and expired codes are rejected", () => {
  const today = madridDate(new Date("2026-10-08T12:00:00Z"));
  assert.equal(calculateCouponDiscount({ code: "HERENCIA100", rules: rules({ expiresAt: today }), items: [product] }).discount, 20);
  for (const changed of [{ active: false }, { expiresAt: "2020-01-01" }, { value: 101 }]) {
    assert.throws(() => calculateCouponDiscount({ code: "HERENCIA100", rules: rules(changed), items: [product] }));
  }
  assert.throws(() => calculateCouponDiscount({ code: "HERENCIA100", rules: rules({ scope: "services" }), items: [product] }));
});

test("atomic usage model blocks second reservation and is idempotent", () => {
  const rule = calculateCouponDiscount({ code: "HERENCIA100", rules: rules(), items: [product] }).rule;
  let state = claimCouponUse({}, rule, "order-one", new Date("2026-10-08T12:00:00Z"));
  state = claimCouponUse(state, rule, "order-one", new Date("2026-10-08T12:00:00Z"));
  assert.equal(state.HERENCIA100.length, 1);
  assert.throws(() => claimCouponUse(state, rule, "order-two", new Date("2026-10-08T12:00:00Z")), /límite/);
  state = settleCouponUse(state, "HERENCIA100", "order-one", "release");
  state = claimCouponUse(state, rule, "order-two", new Date("2026-10-08T12:00:00Z"));
  state = settleCouponUse(state, "HERENCIA100", "order-two", "redeem");
  assert.equal(state.HERENCIA100[0].status, "redeemed");
  assert.throws(() => claimCouponUse(state, rule, "order-three", new Date("2026-10-08T12:00:00Z")), /límite/);
});
