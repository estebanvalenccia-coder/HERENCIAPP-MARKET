import { createHash } from "node:crypto";

export const TIKTOK_PIXEL_ID = "DBG977JC77U4SEFNP21G";
export const TIKTOK_EVENTS_ENDPOINT = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

const money = (value) => Number(Number(value).toFixed(2));
const hashEmail = (email) => {
  const normalized = String(email || "").trim().toLowerCase();
  return normalized && /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(normalized)
    ? createHash("sha256").update(normalized).digest("hex")
    : undefined;
};

/**
 * Only verified, paid, EUR Stripe orders with an explicit opt-in
 * may be sent via the TikTok Events API. Do not infer purchases
 * from checkout visits, unpaid orders, or arbitrary browser calls.
 */
export function buildTikTokPurchasePayload(order, paymentIntent, {now = Date.now(), pixelId = TIKTOK_PIXEL_ID} = {}) {
  if (order?.metadata?.tiktokConsent !== true || order?.metadata?.source !== "frontend_checkout") return null;
  if (order?.status !== "paid" || paymentIntent?.status !== "succeeded") return null;
  if (!order?.id || !/^pi_[A-Za-z0-9_]+$/.test(String(paymentIntent.id || ""))) return null;
  if (String(order.stripe_payment_intent_id || "") !== String(paymentIntent.id)) return null;
  if (String(paymentIntent.currency || "").toLowerCase() !== "eur") return null;
  const amountCents = Number(paymentIntent.amount_received);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) return null;
  const contents = (Array.isArray(order.items) ? order.items : []).map((line) => ({
    content_id: String(line?.id ?? ""),
    content_name: String(line?.name || "").slice(0, 120),
    price: money(Number(line?.unitPrice ?? line?.price)),
    quantity: Math.max(1, Math.floor(Number(line?.quantity ?? 1))),
  })).filter((line) => line.content_id && Number.isFinite(line.price) && line.price >= 0);
  if (!contents.length) return null;
  const hashed = hashEmail(order.customer_email);
  return {
    event_source: "web",
    event_source_id: pixelId,
    data: [{
      event: "Purchase",
      event_time: Math.floor(now / 1000),
      event_id: "purchase_" + String(order.id),
      user: hashed ? {email: hashed} : {},
      properties: {
        currency: "EUR",
        value: money(amountCents / 100),
        content_type: "product",
        contents,
        order_id: String(order.id)
      },
      page: {url: "https://www.herenciamarket.es/pedido-confirmado"}
    }]
  };
}

/** Gracefully skip missing credentials; the Stripe webhook must still succeed. */
export async function sendTikTokPaidOrder(order, paymentIntent, options = {}) {
  const token = options.token ?? process.env.TIKTOK_EVENTS_API_ACCESS_TOKEN;
  if (!token) return {sent: false, reason: "missing_access_token"};
  const payload = buildTikTokPurchasePayload(order, paymentIntent, options);
  if (!payload) return {sent: false, reason: "ineligible_or_no_consent"};
  const request = options.fetchImpl || globalThis.fetch;
  const response = await request(TIKTOK_EVENTS_ENDPOINT, {
    method: "POST",
    headers: {"Access-Token": token, "Content-Type": "application/json"},
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(4500)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.code !== 0) {
    throw new Error("TikTok Events API delivery failed (HTTP " + response.status + ", code " + String(result.code ?? "unknown") + ")");
  }
  return {sent: true, eventId: payload.data[0].event_id};
}
