import test from "node:test";
import assert from "node:assert/strict";
import { compareSupplierFileProducts } from "./supplierFileDiff.js";

const feed={id:"supplierfile_123",name:"Maceta",description:"Artículo",
  supplierId:"sup",supplierProductId:"SKU-A",sourceProductUrl:"https://supplier.example.com/a",
  sourceImageUrl:"https://supplier.example.com/a.jpg",
  minSupplierCost:4.5,currency:"EUR",
  variants:[{name:"Verde",supplierSku:"SKU-G",supplierVariantId:"VID-G"}],
  originalOffers:[{supplierSku:"SKU-G",supplierVariantId:"VID-G",variantName:"Verde",cost:4.5,currency:"EUR"}]};
const merchant={id:"supplierfile_123",name:"Maceta",description:"Artículo",price:18,stock:12,
  status:"draft",variants:[{name:"Verde",supplierSku:"SKU-G",supplierVariantId:"VID-G"}],
  metadata:{supplierFileOriginalUrl:"https://supplier.example.com/a",
    sourceImageUrl:"https://supplier.example.com/a.jpg",supplierCurrency:"EUR",supplierOriginalPrice:4.5,
    supplierVariantPrices:feed.originalOffers}};
test("unknown supplier item is marked new, with no authorisation to update products",()=>{
 const [item]=compareSupplierFileProducts([feed],[]);
 assert.equal(item.status,"new");
 assert.equal(item.automaticUpdateEnabled,false);
 assert.equal(item.merchantChangesProtected,true);
});
test("existing item preserved and marked unchanged when supplier file matches",()=>{
 const [item]=compareSupplierFileProducts([feed],[merchant]);
 assert.equal(item.status,"unchanged");
 assert.deepEqual(item.changedFields,[]);
 assert.equal(item.existingProductId,merchant.id);
 assert.equal(merchant.price,18);
});
test("detect supplier variant cost increase even if minimum stays unchanged",()=>{
 const second={...feed,variants:[
  ...feed.variants,{name:"Roja",supplierSku:"SKU-R",supplierVariantId:"VID-R"},
 ],originalOffers:[...feed.originalOffers,
  {supplierSku:"SKU-R",supplierVariantId:"VID-R",variantName:"Roja",cost:5.5,currency:"EUR"}]};
 const existing={...merchant,variants:second.variants,metadata:{
  ...merchant.metadata,supplierVariantPrices:[
   ...feed.originalOffers,{supplierSku:"SKU-R",supplierVariantId:"VID-R",variantName:"Roja",cost:6.5,currency:"EUR"},
  ]}};
 const [item]=compareSupplierFileProducts([second],[existing]);
 assert.equal(item.status,"changes_detected");
 assert.ok(item.changedFields.includes("supplier_cost"));
 assert.ok(!item.changedFields.includes("variants"));
 assert.equal(existing.price,18);
});
test("conflicting supplier URL associated with a different existing product blocks auto update",()=>{
 const [item]=compareSupplierFileProducts([feed],[{
  ...merchant,id:"a-different-product",
 }]);
 assert.equal(item.status,"conflict");
 assert.deepEqual(item.changedFields,["supplier_identity"]);
 assert.equal(item.automaticUpdateEnabled,false);
});
test("no side-effect: read-only preview does not mutate original merchant or feed",()=>{
 const before=JSON.stringify([feed,merchant]);
 const [result]=compareSupplierFileProducts([feed],[merchant]);
 assert.equal(JSON.stringify([feed,merchant]),before);
 assert.equal(result.automaticUpdateEnabled,false);
});
