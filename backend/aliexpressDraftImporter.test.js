import test from "node:test";
import assert from "node:assert/strict";
import {makeAliExpressUnpublishedDraft} from "./aliexpressDraftImporter.js";

const product = {
 productId:"1005001234567890", name:"Jarrón decorativo",
 status:"active", checkedAt:"2026-10-18T00:00:00Z",
 images:["https://example.com/photo.jpg"],
 variants:[
  {variantId:"sku1",sku:"ABC-S",price:8.35,stock:25,properties:[{name:"Color",value:"Azul"},{name:"Tamaño",value:"Pequeño"}]},
  {variantId:"sku2",sku:"ABC-L",price:9.30,stock:12,properties:[{name:"Color",value:"Verde"},{name:"Tamaño",value:"Grande"}]},
 ],
};
test("AliExpress imported products remain unsellable and preserve exact variants",()=>{
 const result=makeAliExpressUnpublishedDraft(product);
 assert.match(result.id,/^aliexpress_[0-9a-f]{24}$/);
 assert.equal(result.status,"draft");
 assert.equal(result.active,false);
 assert.equal(result.price,0);
 assert.equal(result.stock,0);
 assert.equal(result.metadata.approvedForPublication,false);
 assert.equal(result.metadata.orderAutomationEnabled,false);
 assert.equal(result.variants.length,2);
 assert.deepEqual(result.variants.map(x=>x.name),["Azul / Pequeño","Verde / Grande"]);
 assert.deepEqual(result.variants.map(x=>x.supplierVariantId),["sku1","sku2"]);
 assert.ok(result.variants.every(x=>x.stock===0&&x.price===null));
 assert.equal(makeAliExpressUnpublishedDraft(product).id,result.id);
});
test("Rejects blank product identities and variants",()=>{
 assert.throws(()=>makeAliExpressUnpublishedDraft({productId:"",name:"",variants:[]}));
 assert.throws(()=>makeAliExpressUnpublishedDraft({...product,variants:[{}]}),/identificador/);
});
