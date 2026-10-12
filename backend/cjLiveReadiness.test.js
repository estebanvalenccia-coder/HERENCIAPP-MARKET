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


test("CJ control center has a direct access from the visible orders area in guided view",()=>{
 const panel=readFileSync(new URL("../src/app/components/admin/AdminSuppliersPanel.tsx",import.meta.url),"utf8");
 const start=panel.indexOf('<h2 className="text-xl font-bold">Pedidos CJ: comprobar cuenta real</h2>');
 const end=panel.indexOf('<section id="supplier-orders"',start);
 assert.ok(start>=0 && end>start);
 const section=panel.slice(start,end);
 assert.match(section,/Centro de control CJ/);
 assert.match(section,/openWorkspaceSection\("supplier-cj-automation"\)/);
 // The target is deliberately inside the advanced view. Wait for React to
 // mount it before scrolling; setTimeout(0) could scroll to a missing node.
 assert.match(panel,/pendingWorkspaceTarget/);
 assert.match(panel,/useEffect\(\(\)=>\{/);
 assert.match(panel,/element\.scrollIntoView/);
 assert.doesNotMatch(panel,/window\.setTimeout\(\(\)=>document\.getElementById\(id\)/);
 assert.match(panel,/<AdminCjAutomationStatus\/>/);
});
