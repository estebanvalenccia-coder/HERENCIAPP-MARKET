import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");

test("Neon catalog writer supports create-only without mutating an existing product",()=>{
 const db=read("./neonDb.js");
 const start=db.indexOf("export async function saveNeonCommerceProduct(");
 const end=db.indexOf("export async function archiveNeonCommerceProduct(",start);
 assert.ok(start>0 && end>start);
 const writer=db.slice(start,end);
 assert.match(writer,/createOnly = false/);
 assert.match(writer,/on conflict\(id\) \$\{createOnly \? "do nothing"/);
 assert.match(writer,/returning id/);
 assert.match(writer,/if \(createOnly && !initialWrite\.rows\?\.length\) return null/);
 const check=writer.indexOf("if (createOnly && !initialWrite.rows?.length) return null");
 const mutation=writer.indexOf("update commerce_products set track_inventory");
 assert.ok(check<mutation, "A duplicate must not touch stock, images, collections or variants");
});

test("file importer uses create-only in Neon; duplicates cannot trigger upsert",()=>{
 const gateway=read("./neonGateway.js");
 const b=gateway.indexOf('if(path==="/api/admin/catalog/supplier-file/commit"');
 const e=gateway.indexOf('if(path==="/api/admin/catalog/import-url/product"',b);
 const route=gateway.slice(b,e);
 assert.match(route,/adminSession\(req\)/);
 assert.match(route,/confirmDrafts!==true/);
 assert.match(route,/saveNeonCommerceProduct\(draft,\{id:product\.id,createOnly:true\}\)/);
 assert.match(route,/saved===null/);
 assert.match(route,/status:"skipped_existing"/);
 assert.doesNotMatch(route,/automaticOrdersEnabled:true|createOrderV2|paymentIntents|payBalance/);
});

test("Railway and root package trees both declare identical critical XML parser dependency",()=>{
 const backendPkg=JSON.parse(read("./package.json"));
 const rootPkg=JSON.parse(read("../package.json"));
 const name="fast-xml-parser";
 assert.ok(backendPkg.dependencies[name]);
 assert.equal(backendPkg.dependencies[name],rootPkg.dependencies[name]);
});
