import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("activation status explains real supplier, budget, supervised test and env blockers",()=>{
 const server=readFileSync(new URL("./server.js",import.meta.url),"utf8");
 const start=server.indexOf('app.get("/api/admin/suppliers/cj/automation-readiness"');
 const end=server.indexOf("// Automatically detect critical ambiguous CJ actions.",start);
 assert.ok(start>0&&end>start);
 const part=server.slice(start,end);
 assert.match(part,/requireAdmin/);
 assert.match(part,/activationBlockers/);
 assert.match(part,/cjSandbox===false/);
 assert.match(part,/policy\.configured/);
 assert.match(part,/cjManualAuthorization\?\.approvedByAdminAt/);
 assert.match(part,/CJ_LIVE_ORDER_CREATION_ENABLED/);
 assert.match(part,/CJ_LIVE_PAYMENT_ENABLED/);
 assert.match(part,/readyForUnattendedBuying:authorized/);
 assert.match(part,/validateCjLiveMandate/);
 assert.doesNotMatch(part,/createOrderV2|cjPayOrder\(|\/shopping\/pay\/|paymentIntents\.create/);
 const admin=readFileSync(new URL("../src/app/components/admin/AdminCjAutomationStatus.tsx",import.meta.url),"utf8");
 assert.match(admin,/data\.activationBlockers\.map/);
 assert.match(admin,/Ningún cambio de proveedor/);
});
