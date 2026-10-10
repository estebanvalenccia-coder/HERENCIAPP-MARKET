import test from "node:test";
import assert from "node:assert/strict";
import {readSupplierProductLinks,confirmSupplierProductLink} from "./supplierProductLinks.js";
const products=[
 {id:"supplierfile_a",metadata:{supplierId:"A",importedFromFile:true,gtin:"4006381333931"}},
 {id:"supplierfile_b",metadata:{supplierId:"B",importedFromFile:true,gtin:"4006381333931"}},
 {id:"supplierfile_c",name:"Same title",metadata:{supplierId:"C",importedFromFile:true}},
];
test("only valid product-identity evidence can confirm cross-supplier family",()=>{
 const first=confirmSupplierProductLink("[]",{leftProductId:"supplierfile_a",rightProductId:"supplierfile_b"},products);
 assert.equal(first.created,true);
 assert.equal(first.link.reason,"gtin");
 assert.equal(first.link.confirmedManually,true);
 assert.equal(first.link.variantsEquivalent,false);
 assert.equal(first.link.automaticRouting,false);
 assert.equal(first.link.automaticPurchases,false);
});
test("product family links are idempotent regardless of request order",()=>{
 const first=confirmSupplierProductLink("[]",{leftProductId:"supplierfile_a",rightProductId:"supplierfile_b"},products);
 const second=confirmSupplierProductLink(first.serialized,{leftProductId:"supplierfile_b",rightProductId:"supplierfile_a"},products);
 assert.equal(second.created,false);
 assert.equal(second.link.id,first.link.id);
 assert.equal(readSupplierProductLinks(second.serialized).length,1);
});
test("matching title alone, same supplier or absent product IDs are never sufficient",()=>{
 assert.throws(()=>confirmSupplierProductLink("[]",{
   leftProductId:"supplierfile_a",rightProductId:"supplierfile_c"
 },products),/GTIN/);
 assert.throws(()=>confirmSupplierProductLink("[]",{
   leftProductId:"supplierfile_a",rightProductId:"missing"
 },products),/existir/);
 assert.throws(()=>confirmSupplierProductLink("[]",{
   leftProductId:"supplierfile_a",rightProductId:"supplierfile_a"
 },products),/distintos/);
 const sameSupplier=products.map(p=>({...p,metadata:{...p.metadata,supplierId:"A"}}));
 assert.throws(()=>confirmSupplierProductLink("[]",{
   leftProductId:"supplierfile_a",rightProductId:"supplierfile_b"
 },sameSupplier),/GTIN/);
});
