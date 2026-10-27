// TikTok Pixel: load only after the visitor has opted into analytics cookies.
// Purchase and checkout events must be emitted from verified commerce actions separately.
const PIXEL_ID = "DBG977JC77U4SEFNP21G";
let pixelInitialized = false;

type TikTokQueue = Array<unknown> & {
  methods?: string[];
  setAndDefer?: (queue: any, method: string) => void;
  load?: (id: string) => void;
  page?: () => void;
};

declare global {
  interface Window { ttq?: TikTokQueue; TiktokAnalyticsObject?: string; }
}

export function trackTikTokPageView(): void {
  if (typeof window === "undefined" || localStorage.getItem("herencia_cookie_consent") !== "accepted") return;
  if (!pixelInitialized) {
    window.TiktokAnalyticsObject = "ttq";
    const ttq = (window.ttq = window.ttq || ([] as unknown as TikTokQueue));
    ttq.methods = ["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
    ttq.setAndDefer = (queue: any, method: string) => { queue[method] = (...args: unknown[]) => queue.push([method, ...args]); };
    for (const method of ttq.methods) ttq.setAndDefer(ttq, method);
    ttq.load = (id: string) => {
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.async = true;
      script.src = "https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=" + encodeURIComponent(id) + "&lib=ttq";
      document.head.appendChild(script);
    };
    ttq.load(PIXEL_ID);
    pixelInitialized = true;
  }
  window.ttq?.page?.();
}
