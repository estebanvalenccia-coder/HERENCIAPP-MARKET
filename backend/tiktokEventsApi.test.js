import test from "node:test";
import assert from "node:assert/strict";
import {buildTikTokPurchasePayload, sendTikTokPaidOrder, TIKTOK_EVENTS_ENDPOINT} from "./tiktokEventsApi.js";

const order = {
  id: "order-456",
  status: "paid",
  stripe_payment_intent_id: "pi_123456",
  customer_email: "BUYER@EXAMPLE.COM",
  items: [{id: "sku-1", name: "Maceta", price: 20, quantity: 2}],
  metadata: {source: "frontend_checkout", tiktokConsent: true}
};
const payment = {id: "pi_123456", status: "succeeded", currency: "eur", amount_received: 4500};

test("valid paid Stripe purchase shares actual charged total and stable deduplication id", () => {
  const result = buildTikTokPurchasePayload(order, payment, {now: 1700000000000});
  assert.equal(result.event_source_id, "DBG977JC77U4SEFNP21G");
  assert.equal(result.data[0].event, "Purchase");
  assert.equal(result.data[0].event_id, "purchase_order-456");
  assert.equal(result.data[0].properties.value, 45);
  assert.equal(result.data[0].properties.currency, "EUR");
  assert.equal(result.data[0].properties.contents[0].quantity, 2);
  assert.match(result.data[0].user.email, /^[a-f0-9]{64}$/);
});

test("no marketing consent, unpaid order, pending Stripe or other-currency orders never emit events", () => {
  assert.equal(buildTikTokPurchasePayload({...order, metadata: {...order.metadata, tiktokConsent: false}}, payment), null);
  assert.equal(buildTikTokPurchasePayload({...order, status: "payment_pending"}, payment), null);
  assert.equal(buildTikTokPurchasePayload(order, {...payment, status: "processing"}), null);
  assert.equal(buildTikTokPurchasePayload(order, {...payment, currency: "cop"}), null);
  assert.equal(buildTikTokPurchasePayload(order, {...payment, id: "pi_wrong"}), null);
  assert.equal(buildTikTokPurchasePayload({...order, metadata: {source: "TPV_ADMIN_CARD", tiktokConsent: true}}, payment), null);
});

test("Events API cannot send without a server token", async () => {
  const result = await sendTikTokPaidOrder(order, payment, {token: "", fetchImpl: () => {throw Error("should not send");}});
  assert.equal(result.reason, "missing_access_token");
});

test("valid Events API delivery passes key only in header and reports success", async () => {
  let called = false;
  const result = await sendTikTokPaidOrder(order, payment, {
    token: "test-only-token",
    fetchImpl: async (url, params) => {
      called = true;
      assert.equal(url, TIKTOK_EVENTS_ENDPOINT);
      assert.equal(params.headers["Access-Token"], "test-only-token");
      assert.doesNotMatch(params.body, /test-only-token/);
      assert.equal(JSON.parse(params.body).data[0].event_id, "purchase_order-456");
      return {ok: true, status: 200, json: async () => ({code: 0})};
    }
  });
  assert.equal(called, true);
  assert.equal(result.sent, true);
});
