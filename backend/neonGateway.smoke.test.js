import test from "node:test";
import assert from "node:assert/strict";
import { r2ConfigStatus } from "./r2Media.js";

test("R2 status never exposes credential values", () => {
  const status = r2ConfigStatus();
  assert.equal(typeof status.configured, "boolean");
  for (const value of Object.values(status)) assert.equal(typeof value, "boolean");
});
