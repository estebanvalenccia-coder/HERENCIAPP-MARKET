import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {summarizeCjVariantAudit} from "./cjBulkVariantAudit.js";

const vid="1869634031584169984";
const variants=[{vid,sku:"CJFU224821801AZ",option:"Negra - S",priceUsd:4.50},
 {vid:"1869634031584169985",sku:"CJ-SKU-2",option:"Azul - L",priceUsd:8},
 {vid:"1869634031584169986",sku:"CJ-SKU-3",option:"Verde - XL",priceUsd:9}];
const product={variants:[{supplierVariantId:vid,supplierSku:"CJFU224821801AZ",name:"Negra - S",price:14}]};
test("maps only exact CJ VID/SKU with verified CN stock, no fake public availability",()=>{
 const stock=new Map([[vid,{vid,origin:"CN",quantity:3,verified:true,available:true}],
 ["1869634031584169985",{vid:"1869634031584169985",origin:"US",quantity:99,verified:true,available:true}]]);
 const result=summarizeCjVariantAudit({product,providerVariants:variants,stockByVid:stock,offset:0,limit:2,truncated:false});
 assert.equal(result.nextOffset,2);
 assert.equal(result.batchMax,4);
 assert.equal(result.readOnly,true);
 assert.equal(result.variants[0].stock.quantity,3);
 assert.equal(result.variants[0].publicMapped,true);
 assert.equal(result.variants[0].publicPriceEur,14);
 assert.equal(result.variants[0].supplierPriceUsd,4.5);
 assert.equal(result.variants[1].stock.available,false);
 assert.equal(result.variants[1].stock.verified,false);
 assert.equal(result.variants[1].publicMapped,false);
 assert.ok(result.variants[1].issues.some(x=>x.includes("catálogo")));
});
test("empty CJ product options are not fabricated and invalid batches are blocked",()=>{
 const r=summarizeCjVariantAudit({product,providerVariants:[],offset:0});
 assert.equal(r.totalVariants,0);
 assert.equal(r.nextOffset,null);
 assert.deepEqual(r.variants,[]);
 for(const x of [-1,201,1.5]) assert.throws(()=>summarizeCjVariantAudit({offset:x}),/rango/);
 assert.throws(()=>summarizeCjVariantAudit({limit:5}),/rango/);
});
test("admin variant audit is authenticated, bounded, sequential and never purchases or changes catalog",()=>{
 const gateway=readFileSync(new URL("./neonGateway.js",import.meta.url),"utf8");
 const start=gateway.indexOf('if(path==="/api/admin/catalog/cj-variant-audit"');
 const end=gateway.indexOf('// Audits one live CJ variant',start);
 assert.ok(start>0&&end>start);
 const body=gateway.slice(start,end);
 assert.match(body,/adminSession\(req\)/);
 assert.match(body,/provider\.variants\.slice\(offset,offset\+4\)/);
 assert.match(body,/await queryCjVariantStock\(\{vid:item\.vid,origin:"CN"\}\)/);
 assert.match(body,/CJ_RATE_LIMITED/);
 assert.match(body,/summarizeCjVariantAudit/);
 assert.doesNotMatch(body,/createOrderV2|payBalance|paymentIntents|saveNeonCommerceProduct|upsertNeonStorageValue|patchNeonOrder/);
 const ui=readFileSync(new URL("../src/app/components/admin/AdminSuppliersPanel.tsx",import.meta.url),"utf8");
 assert.match(ui,/Auditar variantes y stock CJ/);
 assert.match(ui,/Siguientes cuatro variantes/);
});
