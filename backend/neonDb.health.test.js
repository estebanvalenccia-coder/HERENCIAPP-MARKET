import test from "node:test";
import assert from "node:assert/strict";
import { hasNeon } from "./neonDb.js";

test("Neon configuration flag is boolean", () => {
  assert.equal(typeof hasNeon, "boolean");
});
