import { isWithinPublicationWindow } from "./publicationSchedule.mjs";

export function isComponentAllowed(controls, id, now = Date.now()) {
  const setting = controls?.[id] || {};
  return setting.enabled !== false && isWithinPublicationWindow(setting.schedule, now);
}

// Complete static Tailwind class strings are required for production CSS generation.
export function componentDeviceClasses(controls, id) {
  const setting = controls?.[id] || {};
  const key = `${setting.mobile !== false ? 1 : 0}${setting.tablet !== false ? 1 : 0}${setting.desktop !== false ? 1 : 0}`;
  const classes = {
    "000": "hidden",
    "001": "hidden lg:contents",
    "010": "hidden sm:contents lg:hidden",
    "011": "hidden sm:contents",
    "100": "contents sm:hidden",
    "101": "contents sm:hidden lg:contents",
    "110": "contents lg:hidden",
    "111": "contents",
  };
  return classes[key] || "contents";
}
