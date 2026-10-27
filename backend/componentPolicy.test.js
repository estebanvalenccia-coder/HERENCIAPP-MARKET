import test from "node:test";
import assert from "node:assert/strict";
import { isComponentAllowed, componentDeviceClasses } from "../src/app/lib/componentPolicy.mjs";

const id = "home.promotions";
const now = Date.parse("2026-10-27T10:00:00Z");

test("unconfigured components remain available by default", () => {
  assert.equal(isComponentAllowed(undefined, id, now), true);
  assert.equal(componentDeviceClasses(undefined, id), "contents");
});

test("explicit OFF takes precedence over a currently valid schedule", () => {
  assert.equal(isComponentAllowed({ [id]: { enabled: false, schedule: {
    startAt: "2026-10-27T09:00:00Z", endAt: "2026-10-27T11:00:00Z"
  } } }, id, now), false);
});

test("scheduling applies to registered components", () => {
  assert.equal(isComponentAllowed({ [id]: { enabled: true, schedule: { startAt: "2026-10-27T10:30:00Z" } } }, id, now), false);
  assert.equal(isComponentAllowed({ [id]: { enabled: true, schedule: { endAt: "2026-10-27T11:00:00Z" } } }, id, now), true);
});

test("all eight desktop/tablet/mobile configurations map to valid classes", () => {
  const expected = {
    "000": "hidden", "001": "hidden lg:contents", "010": "hidden sm:contents lg:hidden",
    "011": "hidden sm:contents", "100": "contents sm:hidden",
    "101": "contents sm:hidden lg:contents", "110": "contents lg:hidden", "111": "contents",
  };
  for (const [key, className] of Object.entries(expected)) {
    const [mobile, tablet, desktop] = key.split("").map((value) => value === "1");
    assert.equal(componentDeviceClasses({ [id]: { mobile, tablet, desktop } }, id), className);
  }
});
