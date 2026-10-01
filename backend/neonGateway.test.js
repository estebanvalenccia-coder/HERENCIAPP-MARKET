import test from "node:test";
import assert from "node:assert/strict";
import { hasNeon, readNeonStorageValue, readNeonStorageValues } from "./neonDb.js";

test("Neon adapter is safe when DATABASE_URL is absent", async () => {
  if (hasNeon) return;
  assert.equal(await readNeonStorageValue("missing"), null);
  assert.deepEqual(await readNeonStorageValues([]), []);
});
