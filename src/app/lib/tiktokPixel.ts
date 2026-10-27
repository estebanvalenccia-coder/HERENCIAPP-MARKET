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
    if (window.localStorage.getItem("herencia_cookie_consent") !== "accepted") return;
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
