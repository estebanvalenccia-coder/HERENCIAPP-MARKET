import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessCjCatalogReadiness } from "./cjCatalogReadiness.js";

const product = {price:30,variants:[{supplierVariantId:"CJ-11111111",supplierSku:"CJ-SKU-A",name:"Negro M"}]};
const metadata = {supplierVariantId:"CJ-11111111",supplierSku:"CJ-SKU-A"};
const variant = {vid:"CJ-11111111",sku:"CJ-SKU-A",priceUsd:9.50};
const stock = {verified:true,vid:"CJ-11111111",origin:"CN",quantity:8,available:true};
const fx = {rate:0.89,date:"2026-10-10"};
test("exact identity, verified stock and real prices become a read-only report",()=>{
 const r=assessCjCatalogReadiness({product,metadata,variant,stock,fx});
 assert.equal(r.productDataValid,true);
 assert.equal(r.stock.quantity,8);
 assert.equal(r.supplierBaseEur,8.46);
 assert.equal(r.supplierBaseCostIncludesShipping,false);
 assert.equal(r.shippingVerified,false);
 assert.equal(r.automaticOrdersEnabled,false);
 assert.equal(r.checkoutEnabled,false);
 assert.equal(r.automaticStockWrite,false);
});
test("unknown or wrong-warehouse stock is never advertised as available",()=>{
 const r=assessCjCatalogReadiness({product,metadata,variant,stock:{...stock,origin:"US",quantity:900},fx});
 assert.equal(r.stock.verified,false);
 assert.equal(r.stock.quantity,null);
 assert.equal(r.stock.available,false);
 assert.ok(r.issues.some(x=>x.includes("Stock")));
});
test("zero stock, missing SKU, stale link and unmatched catalog variant fail closed",()=>{
 const r=assessCjCatalogReadiness({
   product,metadata:{supplierVariantId:"OTHER",supplierSku:"OLD"},
   variant:{...variant,sku:"DIFFERENT"},stock:{...stock,quantity:0},fx,
 });
 assert.equal(r.productDataValid,false);
 assert.ok(r.issues.some(x=>x.includes("VID/SKU guardado")));
 assert.ok(r.issues.some(x=>x.includes("ficha pública")));
 assert.ok(r.issues.some(x=>x.includes("sin existencias")));
});
test("missing FX and invalid price can never turn into valid EUR costs",()=>{
 const r=assessCjCatalogReadiness({product:{...product,price:0},metadata,variant:{...variant,priceUsd:null},stock,fx:null});
 assert.equal(r.supplierBaseEur,null);
 assert.equal(r.productDataValid,false);
 assert.equal(r.shippingVerified,false);
});
test("admin-only audit route never creates orders or saves public stock and price",()=>{
 const gateway=readFileSync(new URL("./neonGateway.js",import.meta.url),"utf8");
 const start=gateway.indexOf('if(path==="/api/admin/catalog/cj-readiness"');
 const end=gateway.indexOf('if(path==="/api/admin/catalog/cj-freight"',start);
 assert.ok(start>0 && end>start);
 const code=gateway.slice(start,end);
 assert.match(code,/adminSession\(req\)/);
 assert.match(code,/queryCjVariantStock/);
 assert.match(code,/queryCjProductVariants/);
 assert.match(code,/assessCjCatalogReadiness/);
 assert.match(code,/upsertNeonStorageValue\(cjObservationKey\(productId,vid\)/);
 assert.doesNotMatch(code,/createOrderV2|cjPayOrder|saveNeonCommerceProduct|paymentIntents/);
});
