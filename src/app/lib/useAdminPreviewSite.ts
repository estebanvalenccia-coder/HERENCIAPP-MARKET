import { useEffect } from "react";
import { parseSiteContent, type SiteContent } from "./siteContent";

/**
 * Only a same-origin parent editor may transmit an unpublished, in-memory preview.
 * No draft is written to storage and a standalone URL never reveals the draft.
 */
export function useAdminPreviewSite(setSite: (site: SiteContent) => void) {
  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;
    if (new URLSearchParams(window.location.search).get("__herencia_preview") !== "1") return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      if (event.data?.type !== "herencia:editor:sync" || typeof event.data.siteRaw !== "string") return;
      try {
        if (event.data.siteRaw.length > 3_500_000) return;
        setSite(parseSiteContent(event.data.siteRaw));
      } catch {
        // The standalone storefront remains on published content.
      }
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "herencia:preview:ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [setSite]);
}

export function isEmbeddedAdminPreview() {
  if (typeof window === "undefined" || window.parent === window) return false;
  return new URLSearchParams(window.location.search).get("__herencia_preview") === "1";
}
