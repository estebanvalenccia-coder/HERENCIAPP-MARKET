import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("supplier URL saves verify the persisted product ID and offer direct editing", () => {
  const panel = read("src/app/components/admin/AdminSuppliersPanel.tsx");
  assert.match(panel, /backendApi\.getCommerceProduct\(imported\.id\)/);
  assert.match(panel, /onOpenProduct\(savedImport\.id\)/);
  assert.match(panel, /result\.skipped/);
  assert.match(panel, /"archived"/);
});

test("bulk URL importer exposes manual fallback and an open-saved-draft action", () => {
  const bulk = read("src/app/components/admin/AdminBulkProductImport.tsx");
  assert.match(bulk, /result\.requiresManual/);
  assert.match(bulk, /backendApi\.getCommerceProduct\(result\.product\.id\)/);
  assert.match(bulk, /onOpenProduct\(savedSourceProduct\.id\)/);
});

test("photo batch importer writes to Neon Commerce rather than legacy adminProducts storage", () => {
  const bulk = read("src/app/components/admin/AdminBulkProductImport.tsx");
  assert.match(bulk, /await backendApi\.createCommerceProduct\(/);
  assert.doesNotMatch(bulk, /backendStorage\.setItem\("adminProducts"/);
});

test("same-name supplier products are not merged and archived duplicates are surfaced", () => {
  const gateway = read("backend/neonGateway.js");
  assert.match(gateway, /String\(metadata\?\.sourceProductUrl\|\|""\)\.trim\(\)===sourceProductUrl/);
  assert.match(gateway, /archived_duplicate/);
  assert.doesNotMatch(gateway, /String\(product\?\.name\|\|""\)\.trim\(\)\.toLowerCase\(\)===name\.toLowerCase\(\)/);
});
