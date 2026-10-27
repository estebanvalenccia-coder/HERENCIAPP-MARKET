import type { CSSProperties, ReactNode } from "react";
import { normalizeComponentDesign } from "../lib/componentDesignPolicy.mjs";
import "./componentDesign.css";
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
  const design = normalizeComponentDesign(controls?.[id]?.design);
  const styled = Object.keys(design).length > 0;
  const designVariables = {
    "--market-design-background": design.backgroundColor,
    "--market-design-text": design.textColor,
    "--market-design-radius": design.radius === undefined ? undefined : `${design.radius}px`,
    "--market-design-padding": design.paddingY === undefined ? undefined : `${design.paddingY}px`,
    "--market-design-margin": design.marginY === undefined ? undefined : `${design.marginY}px`,
    "--market-design-height": design.minHeight === undefined ? undefined : `${design.minHeight}px`,
    "--market-design-width": design.maxWidth === undefined ? undefined : `${design.maxWidth}px`,
    "--market-design-heading": design.headingSize === undefined ? undefined : `${design.headingSize}px`,
  } as CSSProperties;
  return (
    <div
      className={`${componentDeviceClasses(controls, id)}${styled ? " market-component-design" : ""}`}
      style={designVariables}
      data-design-background={design.backgroundColor ? "true" : undefined}
      data-design-text={design.textColor ? "true" : undefined}
      data-design-radius={design.radius !== undefined ? "true" : undefined}
      data-design-padding={design.paddingY !== undefined ? "true" : undefined}
      data-design-margin={design.marginY !== undefined ? "true" : undefined}
      data-design-height={design.minHeight !== undefined ? "true" : undefined}
      data-design-width={design.maxWidth !== undefined ? "true" : undefined}
      data-design-heading={design.headingSize !== undefined ? "true" : undefined}
      data-design-font={design.fontFamily}
      data-design-shadow={design.shadow}
      data-design-animation={design.animation}
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
