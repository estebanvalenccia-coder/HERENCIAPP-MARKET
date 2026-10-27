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
        if (!isEmbeddedAdminPreview()) return;
        event.preventDefault();
        event.stopPropagation();
        window.parent.postMessage({ type: "herencia:preview:select", componentId: id }, window.location.origin);
      }}
    >
      {children}
    </div>
  );
}
