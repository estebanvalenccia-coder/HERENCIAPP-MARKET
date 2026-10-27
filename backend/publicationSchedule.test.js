import test from "node:test";
import assert from "node:assert/strict";
import { isWithinPublicationWindow, isValidPublicationWindow } from "../src/app/lib/publicationSchedule.mjs";

const now = Date.parse("2026-10-27T10:00:00Z");

test("unscheduled content remains visible", () => {
  assert.equal(isWithinPublicationWindow(undefined, now), true);
  assert.equal(isWithinPublicationWindow({}, now), true);
});

test("scheduled content starts inclusively and ends exclusively", () => {
  const window = { startAt: "2026-10-27T09:00:00Z", endAt: "2026-10-27T11:00:00Z" };
  assert.equal(isWithinPublicationWindow(window, Date.parse("2026-10-27T08:59:59Z")), false);
  assert.equal(isWithinPublicationWindow(window, Date.parse("2026-10-27T09:00:00Z")), true);
  assert.equal(isWithinPublicationWindow(window, now), true);
  assert.equal(isWithinPublicationWindow(window, Date.parse("2026-10-27T11:00:00Z")), false);
});

test("respects offset instants instead of visitor timezone", () => {
  assert.equal(isWithinPublicationWindow({ startAt: "2026-10-27T11:00:00+01:00" }, now), true);
  assert.equal(isWithinPublicationWindow({ startAt: "2026-10-27T12:00:00+01:00" }, now), false);
});

test("invalid and reversed windows fail closed", () => {
  assert.equal(isWithinPublicationWindow({ startAt: "not-a-date" }, now), false);
  assert.equal(isWithinPublicationWindow({ startAt: "2026-10-28T00:00:00Z", endAt: "2026-10-26T00:00:00Z" }, now), false);
});

test("rejects timezone-less dates, equal bounds and invalid offsets", () => {
  assert.equal(isValidPublicationWindow({ startAt: "2026-10-27T11:00" }), false);
  assert.equal(isWithinPublicationWindow({ startAt: "2026-10-27T11:00" }, now), false);
  assert.equal(isValidPublicationWindow({ startAt: "2026-10-27T10:00:00Z", endAt: "2026-10-27T10:00:00Z" }), false);
  assert.equal(isValidPublicationWindow({ startAt: "2026-10-27T25:00:00Z" }), false);
});
