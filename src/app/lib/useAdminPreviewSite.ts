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
    // Intercept clicks before React event handlers: the preview must NEVER add
    // products to a cart, trigger chat actions or follow checkout links.
    const preventPreviewAction = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const id = target.closest("[data-storefront-component]")?.getAttribute("data-storefront-component");
      if (id) window.parent.postMessage({ type: "herencia:preview:select", componentId: id }, window.location.origin);
    };
    const preventPreviewSubmit = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    document.addEventListener("click", preventPreviewAction, true);
    document.addEventListener("submit", preventPreviewSubmit, true);
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "herencia:preview:ready" }, window.location.origin);
    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("click", preventPreviewAction, true);
      document.removeEventListener("submit", preventPreviewSubmit, true);
    };
  }, [setSite]);
}

export function isEmbeddedAdminPreview() {
  if (typeof window === "undefined" || window.parent === window) return false;
  return new URLSearchParams(window.location.search).get("__herencia_preview") === "1";
}
