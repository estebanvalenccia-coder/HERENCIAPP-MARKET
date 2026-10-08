import test from "node:test";
import assert from "node:assert/strict";
import { calculateCouponDiscount, validateCouponRule, claimCouponUse, settleCouponUse } from "./promoCodes.js";
import { readFile } from "node:fs/promises";

const items = [
  { price: 20, quantity: 2, type: "product", category: "plantas" },
  { price: 30, quantity: 3, serviceBooking: true, type: "service", category: "servicios" },
];
const rule = (code, value, scope = "all", extra = {}) =>
  ({ code, value, type: "percent", scope, active: true, ...extra });

test("coupons apply to every category and service by default", () => {
  const rules = [rule("herencia10", 10)];
  assert.equal(calculateCouponDiscount({ code: "HERENCIA10", rules, items }).discount, 13);
  assert.equal(calculateCouponDiscount({ code: "HERENCIA10", rules: [rule("HERENCIA10", 50)], items }).discount, 65);
  assert.equal(calculateCouponDiscount({ code: "HERENCIA10", rules: [rule("HERENCIA10", 100)], items }).discount, 130);
});

test("product-only and service-only coupons do not discount other lines", () => {
  assert.equal(calculateCouponDiscount({ code: "ONLY", rules: [rule("ONLY", 50, "products")], items }).discount, 20);
  assert.equal(calculateCouponDiscount({ code: "ONLY", rules: [rule("ONLY", 50, "services")], items }).discount, 45);
});

test("percentage invalid values and inactive coupons are rejected", () => {
  assert.throws(() => calculateCouponDiscount({ code: "BAD", rules: [rule("BAD", 105)], items }), /no válido/);
  assert.throws(() => calculateCouponDiscount({ code: "BAD", rules: [rule("BAD", 50, "all", { active: false })], items }), /desactivado/);
});

test("expiration includes last day in Madrid", () => {
  assert.equal(validateCouponRule(rule("PROMO", 25, "all", { expiresAt: "2026-10-08" }), new Date("2026-10-08T19:00:00Z")).value, 25);
  assert.throws(() => validateCouponRule(rule("PROMO", 25, "all", { expiresAt: "2026-10-08" }), new Date("2026-10-09T09:00:00Z")), /caducado/);
});

test("limited coupons reserve, redeem and release without double redemption", () => {
  const promo = validateCouponRule(rule("LIMITED", 100, "all", { maxUses: 1 }));
  const claimed = claimCouponUse({}, promo, "order1");
  assert.throws(() => claimCouponUse(claimed, promo, "order2"), /límite de usos/);
  assert.deepEqual(claimCouponUse(claimed, promo, "order1"), claimed);
  const redeemed = settleCouponUse(claimed, "LIMITED", "order1", "redeem");
  assert.throws(() => claimCouponUse(redeemed, promo, "order2"), /límite de usos/);
  const released = settleCouponUse(claimed, "LIMITED", "order1", "release");
  assert.equal(claimCouponUse(released, promo, "order2").LIMITED.length, 1);
});

test("promotions flow is secured in admin storage and validated on backend", async () => {
  const [gateway, cart, backend, stripe] = await Promise.all([
    readFile(new URL("./neonGateway.js", import.meta.url), "utf8"),
    readFile(new URL("../src/app/pages/Cart.tsx", import.meta.url), "utf8"),
    readFile(new URL("./server.js", import.meta.url), "utf8"),
    readFile(new URL("../src/app/components/StripeCheckout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(gateway, /protectedKeys = new Set\(\["discountCodes"/);
  assert.match(gateway, /adminOnly = \["discountCodes"/);
  assert.match(cart, /\/api\/coupons\/preview/);
  assert.doesNotMatch(cart, /getItem\("discountCodes"\)/);
  assert.match(backend, /changeCouponUsage\("claim", verifiedPromotion, orderId\)/);
  assert.match(backend, /totalCents === 0/);
  assert.match(stripe, /paymentIntentResponse\.freeOrder/);
});
