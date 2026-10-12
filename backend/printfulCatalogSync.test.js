import test from "node:test";
import assert from "node:assert/strict";
import {normalizePrintfulSyncProduct,getPrintfulSyncProduct,listPrintfulSyncProducts} from "./printfulCatalogSync.js";

const fixture={
 code:200,result:{sync_product:{id:421,name:"Camisa Jungle",variants:4,thumbnail_url:"https://cdn.printful.com/thumbnail.png"},
 sync_variants:[
 {id:100,variant_id:2201,sku:"B-S",name:"Camisa Jungle / Negro / S",synced:true,availability_status:"active",retail_price:"22.00",files:[{preview_url:"https://cdn.printful.com/black-s.png"}]},
 {id:101,variant_id:2202,sku:"B-M",name:"Camisa Jungle / Negro / M",synced:true,availability_status:"active"},
 {id:102,variant_id:2203,sku:"W-S",name:"Camisa Jungle / Blanco / S",synced:true,availability_status:"active"},
 {id:103,variant_id:2204,sku:"W-M",name:"Camisa Jungle / Blanco / M",synced:true,availability_status:"active"},
 ]}};
test("real Printful color-size combinations and sync/catalog IDs",()=>{
 const p=normalizePrintfulSyncProduct(fixture);
 assert.deepEqual(p.variants.map(x=>x.name),["Negro / S","Negro / M","Blanco / S","Blanco / M"]);
 assert.equal(p.variants[0].printfulSyncVariantId,"100");
 assert.equal(p.variants[0].printfulCatalogVariantId,"2201");
 assert.equal(p.variants[0].supplierSku,"B-S");
 assert.equal(p.variants[0].image,"https://cdn.printful.com/black-s.png");
 assert.equal(p.variants[0].price,undefined,"unverified retail currency cannot become EUR");
 assert.equal(p.variants[0].printfulOnDemand,true);
 assert.equal(p.variants[0].stock,0);
});
test("manual euro prices survive repeated provider synchronization",()=>{
 const first=normalizePrintfulSyncProduct(fixture);
 const edited=first.variants.map(x=>x.printfulSyncVariantId==="100"?{...x,price:28.95}:x);
 const again=normalizePrintfulSyncProduct(fixture,{existingVariants:edited});
 assert.equal(again.variants.length,4);
 assert.equal(again.variants[0].price,28.95);
 assert.equal(new Set(again.variants.map(x=>x.printfulSyncVariantId)).size,4);
});
test("invalid, duplicate or partial provider responses reject without writes",()=>{
 const f=structuredClone(fixture);f.result.sync_variants[1].id=100;
 assert.throws(()=>normalizePrintfulSyncProduct(f),/duplicadas/);
 const short=structuredClone(fixture);short.result.sync_variants.pop();
 assert.throws(()=>normalizePrintfulSyncProduct(short),/incompleta/);
 assert.throws(()=>normalizePrintfulSyncProduct({result:{sync_product:{id:1},sync_variants:[]}}),/completas/);
});
test("provider active status does not invent physical inventory",()=>{
 const p=normalizePrintfulSyncProduct(fixture);
 assert.equal(p.inventoryMode,"printful_on_demand");
 assert.ok(p.variants.every(v=>v.stock===0 && v.printfulAvailability==="active"));
});
test("read-only official API sends token only from backend and honors store context",async()=>{
 const calls=[];
 const env={PRINTFUL_API_TOKEN:"test-private",PRINTFUL_STORE_ID:"612"};
 const fetchImpl=async(url,init)=>{calls.push({url,init});return {ok:true,status:200,json:async()=>fixture}};
 const p=await getPrintfulSyncProduct("421",{env,fetchImpl});
 assert.equal(p.variants.length,4);
 assert.ok(calls[0].url.endsWith("/store/products/421"));
 assert.equal(calls[0].init.headers["X-PF-Store-Id"],"612");
 assert.equal(calls[0].init.headers.Authorization,"Bearer test-private");
});
test("API failures do not produce variant data or writes",async()=>{
 const env={PRINTFUL_API_TOKEN:"test-private"};
 await assert.rejects(getPrintfulSyncProduct("421",{env,fetchImpl:async()=>({ok:false,status:403})}),/permisos|acceso/);
 await assert.rejects(getPrintfulSyncProduct("421",{env,fetchImpl:async()=>({ok:false,status:429}),wait:async()=>{}}),/limita/);
});
test("Printful paginated product listing",async()=>{
 let calls=0;
 const fetchImpl=async()=>{calls++;return {ok:true,status:200,json:async()=>({result:calls===1?
  Array.from({length:100},(_,i)=>({id:i+1,name:"shirt"+i,variants:2})):
  [{id:101,name:"last shirt",variants:1}]})}};
 const products=await listPrintfulSyncProducts({env:{PRINTFUL_API_TOKEN:"token"},fetchImpl});
 assert.equal(products.length,101);
 assert.equal(calls,2);
});
