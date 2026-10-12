import test from "node:test";
import assert from "node:assert/strict";
import {chooseCjDraftVariant,createCjDraftAutoLink} from "./cjDraftAutoLink.js";
const pid="1795004373211291648";
const product={id:"1791821163765",status:"draft",metadata:{
 sourceHost:"cjdropshipping.com",fulfillmentType:"dropship",supplierId:"CJ-CONNECTED",
 sourceProductUrl:"https://cjdropshipping.com/product/plant-clips-p-"+pid+".html",
 supplierProductId:pid,supplierSku:"",supplierVariantId:"",
 cjAutoLinkRequest:{pid,quantity:50,color:"white"}
}};
const response={source:"cj_api",pid,truncated:false,variants:[
 {vid:"20777000123567890",sku:"CJPLANT-50-WHITE",option:"50pcs-White",priceUsd:0.82},
 {vid:"20777000123567891",sku:"CJPLANT-100-WHITE",option:"100pcs-White",priceUsd:1.6},
 {vid:"20777000123567892",sku:"CJPLANT-50-GREEN",option:"50pcs-Green",priceUsd:0.78},
]};
test("selects exact fifty-white CJ variant from a fully confirmed supplier list",()=>{
 const selected=chooseCjDraftVariant(product,response);
 assert.equal(selected.ok,true);
 assert.equal(selected.vid,"20777000123567890");
 assert.equal(selected.sku,"CJPLANT-50-WHITE");
 assert.equal(selected.supplierPriceUsd,0.82);
});
test("never fabricates a VID for ambiguous, truncated, stale or unverifiable supplier responses",()=>{
 const bad=[
  {...response,truncated:true},
  {...response,source:"local"},
  {...response,pid:"WRONG"},
  {...response,variants:response.variants.filter(v=>v.option!=="50pcs-White")},
  {...response,variants:[response.variants[0],response.variants[0]]},
  {...response,variants:[{...response.variants[0],priceUsd:null}]},
 ];
 for(const fake of bad)assert.equal(chooseCjDraftVariant(product,fake).ok,false);
 assert.equal(chooseCjDraftVariant({...product,status:"active"},response).ok,false);
 assert.equal(chooseCjDraftVariant({...product,metadata:{...product.metadata,supplierVariantId:"ALREADY"}},response).ok,false);
});
test("draft linker reads CJ but only saves a confirmed exact option",async()=>{
 let saved=null,calls=0;
 const worker=createCjDraftAutoLink({
  listProducts:async()=>[product],
  queryVariants:async requested=>{assert.equal(requested,pid);calls++;return response;},
  saveBinding:async row=>{saved=row;return true;},
  logger:{warn(){}}
 });
 const result=await worker.sweep();
 assert.equal(result.linked,1);
 assert.equal(saved.productId,product.id);
 assert.equal(saved.vid,response.variants[0].vid);
 assert.equal(calls,1);
});
test("draft linker skips unverified catalog and never writes a product",async()=>{
 let writes=0;
 const worker=createCjDraftAutoLink({
  listProducts:async()=>[product],
  queryVariants:async()=>({...response,truncated:true}),
  saveBinding:async()=>{writes++;return true;},
  logger:{warn(){}}
 });
 assert.equal((await worker.sweep()).blocked,1);
 assert.equal(writes,0);
});
