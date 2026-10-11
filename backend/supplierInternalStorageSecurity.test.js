import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isPrivateSupplierStorageKey} from "./supplierInternalStorageSecurity.js";

test("CJ non-repeatable purchase/payment and tracking keys cannot be addressed generically",()=>{
 const forbidden=[
  "cjManualExternalAction:create:fulfill-123",
  "cjManualExternalAction:pay:fulfill-123",
  "cjTrackingReadOnlyLease:fulfill-123",
  "cjStockObservation:v1:product:vid",
  "cjStockObserverLease:v1",
  "cjStockObserverCursor:v1",
  "supplierWebhookDispatch:order-123",
  "  CJMANUALEXTERNALACTION:PAY:123  ",
 ];
 for(const key of forbidden)assert.equal(isPrivateSupplierStorageKey(key),true,key);
 for(const key of ["cart","user","siteContent","posOperations","adminSuppliers","",null])
  assert.equal(isPrivateSupplierStorageKey(key),false,String(key));
});
test("Neon generic storage route fails closed for supplier ledgers before any read/write",()=>{
 const gateway=readFileSync(new URL("./neonGateway.js",import.meta.url),"utf8");
 const start=gateway.indexOf("const storageMatch=path.match");
 const end=gateway.indexOf("// Read-only CJ shipping-rate estimate",start);
 assert.ok(start>0&&end>start);
 const block=gateway.slice(start,end);
 assert.match(block,/isPrivateSupplierStorageKey\(key\)/);
 const guard=block.indexOf("isPrivateSupplierStorageKey(key)");
 const rawRead=block.indexOf('readNeonStorageValue(dbKey)');
 const rawWrite=block.indexOf('upsertNeonStorageValue(dbKey');
 const rawDelete=block.indexOf('deleteNeonStorageValue(dbKey');
 assert.ok(guard<rawRead&&guard<rawWrite&&guard<rawDelete);
 assert.match(block,/return json\(res,403/);
});
