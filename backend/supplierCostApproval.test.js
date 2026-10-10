import test from "node:test";
import assert from "node:assert/strict";
import {prepareSupplierCostApproval} from "./supplierCostApproval.js";

const current={
 id:"supplierfile_0123456789abcdef0123456789abcdef",name:"Maceta",
 status:"draft",updatedAt:"2026-10-10T10:00:00.000Z",
 price:25,stock:8,images:[{url:"https://example.com/photo.jpg"}],
 variants:[
  {name:"Verde EU",supplierSku:"POT-G-EU",supplierVariantId:"VID-EU"},
  {name:"Verde US",supplierSku:"POT-G-US",supplierVariantId:"VID-US"},
 ],
 metadata:{importedFromFile:true,supplierId:"vendor1",supplierOriginalPrice:5}
};
const file={
 id:current.id,supplierId:"vendor1",currency:"EUR",minSupplierCost:6,
 variants:[...current.variants],
 originalOffers:[
  {supplierVariantId:"VID-EU",supplierSku:"POT-G-EU",variantName:"Verde EU",cost:6,currency:"EUR"},
  {supplierVariantId:"VID-US",supplierSku:"POT-G-US",variantName:"Verde US",cost:7,currency:"EUR"},
 ]};
test("manual supplier-cost approval is unverified and cannot change storefront price or inventory",()=>{
 const before=JSON.stringify({current,file});
 const result=prepareSupplierCostApproval(file,current,current.updatedAt);
 assert.equal(result.minimumCost,6);
 assert.equal(result.offers[1].cost,7);
 assert.equal(result.preserveMerchantFields,true);
 assert.equal(result.publicPriceChanged,false);
 assert.equal(result.publicStockChanged,false);
 assert.equal(result.sourceCostStillUnverified,true);
 assert.equal(JSON.stringify({current,file}),before);
});
test("rejects stale review, foreign supplier, published article and non-identical SKU/VID",()=>{
 for(const [offer,record,version] of [
  [file,current,"2026-10-10T09:00:00.000Z"],
  [file,{...current,status:"active"},current.updatedAt],
  [{...file,supplierId:"attacker"},current,current.updatedAt],
  [{...file,variants:[{...file.variants[0],supplierVariantId:"OTHER"},file.variants[1]]},
   current,current.updatedAt],
  [{...file,variants:file.variants.slice(0,1)},current,current.updatedAt],
 ])assert.throws(()=>prepareSupplierCostApproval(offer,record,version));
});
test("requires provider cost currencies and unique variant tuples",()=>{
 const duplicate={...file,originalOffers:[file.originalOffers[0],file.originalOffers[0]]};
 const wrongCurrency={...file,originalOffers:[file.originalOffers[0],{...file.originalOffers[1],currency:"USD"}]};
 assert.throws(()=>prepareSupplierCostApproval(duplicate,current,current.updatedAt),/duplicadas/);
 assert.throws(()=>prepareSupplierCostApproval(wrongCurrency,current,current.updatedAt),/moneda/);
});
