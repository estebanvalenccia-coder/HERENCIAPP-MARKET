import type { ReactNode } from "react";
import { isEmbeddedAdminPreview } from "../lib/useAdminPreviewSite";
import {
  componentDeviceClasses,
  isComponentAllowed,
  type StorefrontComponentControl,
  type StorefrontComponentKey,
} from "../lib/componentRegistry";

export function StorefrontComponentBoundary({
  id,
  controls,
  now,
  enabled = true,
  children,
}: {
  id: StorefrontComponentKey;
  controls: Record<string, StorefrontComponentControl> | undefined;
  now: number;
  enabled?: boolean;
  children: ReactNode;
}) {
  if (!enabled || !isComponentAllowed(controls, id, now)) return null;
  return (
    <div
      className={componentDeviceClasses(controls, id)}
      data-storefront-component={id}
      onClickCapture={(event) => {
        if (!isEmbeddedAdminPreview()) {
          // Analytics is opt-in. A section impression or ordinary scrolling is not a click.
          const clicked = event.target instanceof Element ? event.target.closest("a, button") : null;
          if (clicked && window.localStorage.getItem("herencia_cookie_consent") === "accepted") {
            void fetch("/api/analytics/visit", {
              method: "POST",
              credentials: "include",
              keepalive: true,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                eventType: "storefront_click",
                eventLabel: id,
                path: window.location.pathname,
              }),
            }).catch(() => undefined);
          }
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        window.parent.postMessage({ type: "herencia:preview:select", componentId: id }, window.location.origin);
      }}
    >
      {children}
    </div>
  );
}
