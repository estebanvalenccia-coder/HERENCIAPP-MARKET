import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessCjPublicProductStatus} from "../src/app/lib/cjFulfillmentIdentity.js";

const product={status:"active",price:14,variants:[],metadata:{
  sourceHost:"cjdropshipping.com",fulfillmentType:"dropship",
  supplierId:"supplier-cj",supplierVariantId:"1869634031584169984",supplierSku:"CJFU224821801AZ",
  cjPreferredLogisticName:"",fulfillmentMode:"autopilot"
}};
test("an active CJ product without verified shipping is visibly blocked before Stripe",()=>{
 const result=assessCjPublicProductStatus(product);
 assert.equal(result.cj,true);
 assert.equal(result.availableToAdd,false);
 assert.ok(result.blockers.some(x=>x.includes("transporte")));
 assert.ok(result.warnings.some(x=>x.includes("color y tamaño")));
 assert.ok(result.warnings.some(x=>x.includes("Autopilot")));
 assert.equal(assessCjPublicProductStatus({...product,metadata:{...product.metadata,cjPreferredLogisticName:"CJPacket"}}).availableToAdd,true);
 assert.equal(assessCjPublicProductStatus({...product,metadata:{...product.metadata,supplierId:""}}).availableToAdd,false);
 assert.equal(assessCjPublicProductStatus({name:"Planta",price:20,metadata:{}}).availableToAdd,true);
});
test("frontend and admin expose actionable shipping and variant blockers, preserve order safety",()=>{
 const detail=readFileSync(new URL("../src/app/pages/ProductDetail.tsx",import.meta.url),"utf8");
 const admin=readFileSync(new URL("../src/app/components/admin/AdminSuppliersPanel.tsx",import.meta.url),"utf8");
 const server=readFileSync(new URL("./cjCheckoutSafety.js",import.meta.url),"utf8");
 assert.match(detail,/disabled=\{!cjSellability.availableToAdd/);
 assert.match(admin,/Importar variantes reales CJ/);
 assert.match(admin,/supplier\.integrationType === "cj" && supplier\.fulfillmentMode === "autopilot"/);
 assert.match(admin,/supplierVariantId: resetCj \? ""/);
 assert.match(admin,/sourceCatalogUrl: changedSupplier/);
 assert.doesNotMatch(admin.slice(admin.indexOf("const linkExistingProduct = async"),admin.indexOf("const saveSupplier = async")),/trackInventory:\s*false/);
 assert.match(server,/if \(!logisticName\) invalid/);
});
