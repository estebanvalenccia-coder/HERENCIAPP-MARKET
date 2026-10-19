import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("./server.js",import.meta.url),"utf8");

test("AliExpress cannot be represented as ready to place a supplier order",()=>{
  assert.match(source,/function aliExpressQueueBlocker\(/);
  assert.match(source,/El pago automático al proveedor no está implementado/);
  assert.match(source,/const aliExpressBlocker = aliExpressQueueBlocker\(\{/);
  assert.match(source,/status = "connector_required";\s*blocker = aliExpressBlocker/);
});
test("Queue exposes blockers for previous manual_ready rows without rewriting provider orders",()=>{
  assert.match(source,/aliExpressQueueBlocker\(record\) : ""/);
  assert.match(source,/return blocker \? \{ \.\.\.record, status: "connector_required", blocker \} : record/);
});
test("Exact purchased variant identity is used, never blindly the product default",()=>{
  assert.match(source,/catalogMatches\.length === 1 \? catalogMatches\[0\] : null/);
  assert.match(source,/catalogVariant\?\.supplierVariantId/);
  assert.match(source,/catalogVariant\?\.supplierSku \|\| catalogVariant\?\.sku/);
});
test("AliExpress generic execute button never submits or pays a supplier order",()=>{
  const start=source.indexOf("async function executeSupplierFulfillment(");
  const finish=source.indexOf("async function syncCjSupplierFulfillment(",start);
  const execute=source.slice(start,finish);
  assert.match(execute,/const aliExpressBlocker = aliExpressQueueBlocker\(record\)/);
  assert.match(execute,/executed: false, manual: false/);
});
