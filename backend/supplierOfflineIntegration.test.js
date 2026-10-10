import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("admin-only supplier workflows never call order creation, Stripe or refund APIs",()=>{
 const s=read("./neonGateway.js");
 const b=s.indexOf('if(path==="/api/admin/catalog/supplier-file/review-costs"');
 const e=s.indexOf('if(path==="/api/admin/catalog/import-url/product"',b);
 assert.ok(b>0&&e>b);
 const route=s.slice(b,e);
 assert.match(route,/adminSession\(req\)/);
 assert.match(route,/prepareSupplierCostApproval/);
 assert.match(route,/approveNeonSupplierFileCosts/);
 assert.match(route,/confirmSupplierProductLink/);
 assert.match(route,/createAftercareCase/);
 assert.match(route,/transitionAftercareCase/);
 assert.doesNotMatch(route,/payBalance|createOrderV2|paymentIntents|refunds\.create|stripe\.refund/);
});
test("single-query cost approval never rewrites merchant price, stock, variants or images",()=>{
 const db=read("./neonDb.js");
 const b=db.indexOf("export async function approveNeonSupplierFileCosts(");
 const e=db.indexOf("export async function archiveNeonCommerceProduct(",b);
 const section=db.slice(b,e);
 assert.match(section,/status='draft'/);
 assert.match(section,/metadata->>'supplierId'/);
 assert.match(section,/metadata->>'importedFromFile'='true'/);
 assert.match(section,/updated_at=\$6::timestamptz/);
 assert.match(section,/supplierOffersUnverified/);
 assert.doesNotMatch(section,/set price=|set stock=|commerce_product_variants|commerce_product_images|commerce_product_collections/);
});
test("offline work cannot silently activate supplier purchases",()=>{
 const engine=read("./supplierOfflineIntelligence.js");
 assert.match(engine,/automaticPurchasesEnabled:false/);
 assert.match(engine,/defaultOrderMode:"disabled"/);
 const aftercare=read("./supplierAftercare.js");
 assert.doesNotMatch(aftercare,/Stripe|paymentIntent|createOrderV2/);
});
