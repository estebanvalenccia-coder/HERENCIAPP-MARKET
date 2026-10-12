import test from "node:test";
import assert from "node:assert/strict";
import {prepareCjVariantPriceRequest,quoteCjVariantRetailPrice,createCjVariantAutoPricing} from "./cjVariantAutoPricing.js";

const pid="2501080655431624400";
const variants=[
 {name:"8inch Elbow",sku:"CJYD226472005EV",supplierSku:"CJYD226472005EV",supplierVariantId:"2501080655431625800"},
 {name:"10inch Elbow",sku:"CJYD226472004DW",supplierSku:"CJYD226472004DW",supplierVariantId:"2501080655431625100"},
];
const product={id:"1791825947036",status:"active",variants,metadata:{
 sourceHost:"cjdropshipping.com",supplierId:"CJ-CONNECTED",fulfillmentType:"dropship",
 sourceProductUrl:"https://cjdropshipping.com/product/portable-garden-labor-saving-garden-scissors-tools-p-"+pid+".html",
 cjVariantAutoPricingRequest:{pid,zip:"08001"},
}};
const provider={pid,source:"cj_api",truncated:false,variants:[
 {vid:variants[0].supplierVariantId,sku:variants[0].sku,priceUsd:3.62},
 {vid:variants[1].supplierVariantId,sku:variants[1].sku,priceUsd:5.99},
]};
const fx={rate:0.90,date:"2026-10-12"};
const freight=vid=>({source:"cj_api",origin:"CN",destination:"ES",zip:"08001",
 vid,quantity:1,methods:[{name:"CJPacket",shippingUsd:6.5,totalPostageUsd:7.4}]});

test("validates CJ identity for each retail variant and refuses a truncated provider response",()=>{
 const plan=prepareCjVariantPriceRequest(product,provider);
 assert.equal(plan.ok,true);
 assert.equal(plan.pending.length,2);
 assert.equal(prepareCjVariantPriceRequest(product,{...provider,truncated:true}).ok,false);
 assert.equal(prepareCjVariantPriceRequest(product,{...provider,variants:[provider.variants[0]]}).ok,false);
 assert.equal(prepareCjVariantPriceRequest({...product,status:"archived"},provider).ok,false);
 assert.equal(prepareCjVariantPriceRequest({...product,metadata:{...product.metadata,sourceHost:"printful.com"}},provider).ok,false);
});
test("real CJ postage, FX, VAT and target margin produce a safe EUR retail price per VID",()=>{
 const low=quoteCjVariantRetailPrice({variant:{...variants[0],priceUsd:3.62,vid:variants[0].supplierVariantId},freight:freight(variants[0].supplierVariantId),fx,zip:"08001"});
 const high=quoteCjVariantRetailPrice({variant:{...variants[1],priceUsd:5.99,vid:variants[1].supplierVariantId},freight:freight(variants[1].supplierVariantId),fx,zip:"08001"});
 assert.equal(low.ok,true);
 assert.equal(high.ok,true);
 assert.ok(high.priceEur>low.priceEur);
 assert.ok(low.estimatedMarginPercent>=30);
 assert.ok(high.estimatedMarginPercent>=30);
 assert.ok(String(low.priceEur).endsWith(".99"));
});
test("missing total postage or mismatched destination blocks pricing instead of guessing shipping",()=>{
 const variant={...variants[0],vid:variants[0].supplierVariantId,priceUsd:3.62};
 assert.equal(quoteCjVariantRetailPrice({variant,freight:{...freight(variant.vid),methods:[{name:"CJPacket",shippingUsd:5,totalPostageUsd:null}]},fx,zip:"08001"}).ok,false);
 assert.equal(quoteCjVariantRetailPrice({variant,freight:{...freight(variant.vid),zip:"28001"},fx,zip:"08001"}).ok,false);
 assert.equal(quoteCjVariantRetailPrice({variant,freight:freight(variant.vid),fx:null,zip:"08001"}).ok,false);
});
test("automated job saves only authenticated per-variant previews and never publishes or buys",async()=>{
 const saved=[];
 let completed=0;
 const job=createCjVariantAutoPricing({
  listProducts:async()=>[product],
  queryVariants:async x=>{assert.equal(x,pid);return provider;},
  quoteFreight:async req=>freight(req.vid),
  getFx:async()=>fx,
  savePrice:async row=>{saved.push(row);return true;},
  completeRequest:async()=>{completed++;return true;},
  logger:{warn(){}}
 });
 const report=await job.sweep();
 assert.equal(report.priced,2);
 assert.equal(report.blocked,0);
 assert.equal(saved.length,2);
 assert.ok(saved.every(x=>x.productId===product.id&&x.zip==="08001"));
 assert.equal(completed,1);
});
