// TikTok browser Pixel. Never load it before optional analytics consent.
const PIXEL_ID = "DBG977JC77U4SEFNP21G";
let initialized = false;

type PixelQueue = any;
declare global {
  interface Window {
    ttq?: PixelQueue;
    TiktokAnalyticsObject?: string;
  }
}

export function trackTikTokPageView(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem("herencia_cookie_consent") !== "accepted" || localStorage.getItem("herencia_ads_consent_v1") !== "accepted") return;
  } catch {
    return;
  }

  if (!initialized) {
    // Official TikTok bootstrap, deferred until explicit consent.
    const w = window;
    const d = document;
    const t = "ttq";
    w.TiktokAnalyticsObject = t;
    const ttq = (w.ttq = w.ttq || []);
    ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"];
    ttq.setAndDefer = function (queue: PixelQueue, method: string) {
      queue[method] = function (...args: unknown[]) {
        queue.push([method, ...args]);
      };
    };
    for (const method of ttq.methods) ttq.setAndDefer(ttq, method);
    ttq.instance = function (id: string) {
      const instance = ttq._i[id] || [];
      for (const method of ttq.methods) ttq.setAndDefer(instance, method);
      return instance;
    };
    ttq.load = function (id: string, options?: Record<string, unknown>) {
      const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._i = ttq._i || {};
      ttq._i[id] = [];
      ttq._i[id]._u = url;
      ttq._t = ttq._t || {};
      ttq._t[id] = Date.now();
      ttq._o = ttq._o || {};
      ttq._o[id] = options || {};
      const script = d.createElement("script");
      script.type = "text/javascript";
      script.async = true;
      script.src = url + "?sdkid=" + encodeURIComponent(id) + "&lib=" + t;
      const first = d.getElementsByTagName("script")[0];
      if (first?.parentNode) first.parentNode.insertBefore(script, first);
      else d.head.appendChild(script);
    };
    ttq.load(PIXEL_ID);
    initialized = true;
  }
  wPage();
}

function wPage(): void {
  window.ttq?.page?.();
}

/** Send only consented browser events with validated EUR commerce fields. */
export function trackTikTokCommerceEvent(event: "ViewContent" | "AddToCart" | "InitiateCheckout", items: Array<{id: unknown; price: unknown; quantity?: unknown}>, total?: number): void {
  if (typeof window === "undefined") return;
  try { if (window.localStorage.getItem("herencia_cookie_consent") !== "accepted" || localStorage.getItem("herencia_ads_consent_v1") !== "accepted") return; } catch { return; }
  trackTikTokPageViewOnce();
  const contents = items.map(item => ({
    content_id: String(item.id ?? ""),
    content_type: "product",
    price: Number(item.price),
    quantity: Math.max(1, Number(item.quantity || 1)),
  })).filter(item => item.content_id && Number.isFinite(item.price) && item.price >= 0);
  if (!contents.length) return;
  const value = typeof total === "number" && Number.isFinite(total) ? total : contents.reduce((sum, item) => sum + item.price * item.quantity, 0);
  window.ttq?.track?.(event, { contents, content_type: "product", currency: "EUR", value });
}
function trackTikTokPageViewOnce(): void {
  if (!initialized) trackTikTokPageView();
}

/** Record a confirmed Stripe payment once per browser/order; never mark pending as purchased. */
export function trackTikTokConfirmedPurchase(orderId: string, paymentIntentId: string, items: Array<{id: unknown; price: unknown; quantity?: unknown}>, paidTotal: number): void {
  if (!orderId || !/^pi_/.test(paymentIntentId) || !Number.isFinite(paidTotal) || paidTotal <= 0) return;
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem("herencia_cookie_consent") !== "accepted" || localStorage.getItem("herencia_ads_consent_v1") !== "accepted") return;
    const key = "herencia_tiktok_purchase_" + orderId;
    if (localStorage.getItem(key)) return;
    const contents = items.map(item => ({
      content_id: String(item.id ?? ""), content_type: "product",
      price: Number(item.price), quantity: Math.max(1, Number(item.quantity || 1))
    })).filter(item => item.content_id && Number.isFinite(item.price) && item.price >= 0);
    if (!contents.length) return;
    trackTikTokPageViewOnce();
    window.ttq?.track?.("Purchase", { contents, content_type: "product", currency: "EUR", value: paidTotal, order_id: orderId }, { event_id: "purchase_" + orderId });
    localStorage.setItem(key, "1");
  } catch { /* Analytics must never interrupt checkout. */ }
}

/**
 * Detect real increases in persisted cart lines, regardless of the UI route
 * (home, product list, product detail, AI assistant or bouquet builder).
 * No events are sent for removals, quantity decreases, checkout cart clearing,
 * or restoring the same cart content from the backend.
 */
export function trackTikTokCartDifference(beforeJson: string | null, afterJson: string): void {
  let before: any[], after: any[];
  try {
    before = JSON.parse(beforeJson || "[]");
    after = JSON.parse(afterJson);
    if (!Array.isArray(before) || !Array.isArray(after)) return;
  } catch { return; }
  const keyOf = (line: any) => String(line?.lineKey || [line?.id, line?.selectedVariant || "", line?.personalization?.dedication || ""].join("::"));
  const quantities = new Map<string, number>();
  for (const line of before) {
    if (line?.id == null) continue;
    const key = keyOf(line);
    quantities.set(key, (quantities.get(key) || 0) + Math.max(1, Number(line.quantity || 1)));
  }
  const added: Array<{id: string; price: number; quantity: number}> = [];
  for (const line of after) {
    if (line?.id == null) continue;
    const key = keyOf(line);
    const previous = quantities.get(key) || 0;
    const current = Math.max(1, Number(line.quantity || 1));
    const delta = Math.max(0, current - previous);
    quantities.set(key, Math.max(0, previous - current)); // Account for split lines of one variant.
    if (!delta) continue;
    const price = Number(line.unitPrice ?? line.price);
    if (!Number.isFinite(price) || price < 0) continue;
    added.push({id:String(line.id), price, quantity:delta});
  }
  if (added.length) trackTikTokCommerceEvent("AddToCart", added);
}
