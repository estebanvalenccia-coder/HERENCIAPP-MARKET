import test from "node:test";
import assert from "node:assert/strict";
import { createMediaObjectName } from "./r2Media.js";

test("R2 media names are scoped and sanitized", () => {
  const name = createMediaObjectName("Mi foto cactus!!.PNG", "webp");
  assert.match(name, /^builder\/\d+-[a-f0-9-]+-Mi-foto-cactus\.webp$/i);
  assert.equal(name.includes(" "), false);
});
