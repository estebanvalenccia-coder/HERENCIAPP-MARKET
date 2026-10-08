import test from "node:test";
import assert from "node:assert/strict";
import { isPrivateSupportStorageKey } from "./supportStorageSecurity.js";

test("all stored private support records must be blocked in public storage", () => {
  assert.equal(isPrivateSupportStorageKey("customerSupportIndex"), true);
  assert.equal(isPrivateSupportStorageKey("customerSupport:customer-123"), true);
  assert.equal(isPrivateSupportStorageKey("customerSupport:"), true);
});

test("existing public site storage keys remain unaffected", () => {
  assert.equal(isPrivateSupportStorageKey("siteContent"), false);
  assert.equal(isPrivateSupportStorageKey("adminProducts"), false);
  assert.equal(isPrivateSupportStorageKey("customerSupport"), false);
});
