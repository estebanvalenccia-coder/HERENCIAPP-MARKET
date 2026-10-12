import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {cjFactoryObservationKey,readCjFactoryObservation} from "./cjFactorySupply.js";
import {
  cjObservationKey,cjObservedTargets,readCjObservation,createCjStockObserver,
} from "./cjStockObserver.js";

const PID="1791634913909",VID="1869634031584169984",NOW=Date.parse("2026-10-11T18:00:00Z");
const product={id:PID,status:"active",metadata:{
  fulfillmentType:"dropship",sourceHost:"cjdropshipping.com",
  supplierVariantId:VID,supplierSku:"CJFU224821801AZ",
},variants:[]};

test("selects only active CJ items with real VID/SKU, never local or archived stock",()=>{
 const targets=cjObservedTargets([product,{...product,status:"archived"},{
   ...product,id:"other",metadata:{...product.metadata,sourceHost:"aliexpress.com"}
 },{...product,id:"bad",metadata:{...product.metadata,supplierSku:""}},product]);
 assert.deepEqual(targets,[{productId:PID,vid:VID,origin:"CN"}]);
});

test("snapshots are fresh only for same exact product, variant, origin and verified CJ stock",()=>{
 const raw=JSON.stringify({productId:PID,vid:VID,origin:"CN",quantity:2,
   source:"cj_api",verified:true,checkedAt:new Date(NOW).toISOString()});
 assert.equal(readCjObservation(raw,{productId:PID,vid:VID,nowMs:NOW+60_000}).available,true);
 assert.equal(readCjObservation(raw,{productId:PID,vid:VID,nowMs:NOW+50*60_000}).available,false);
 assert.equal(readCjObservation(raw,{productId:"other",vid:VID,nowMs:NOW}).verified,false);
 assert.equal(readCjObservation(raw,{productId:PID,vid:"wrong",nowMs:NOW}).fresh,false);
 assert.equal(readCjObservation(raw.replace('"CN"','"US"'),{productId:PID,vid:VID,nowMs:NOW}).fresh,false);
 assert.equal(readCjObservation(null,{productId:PID,vid:VID,nowMs:NOW}).available,false);
 assert.equal(readCjObservation(raw.replace('"quantity":2','"quantity":0'),{productId:PID,vid:VID,nowMs:NOW}).quantity,0);
 assert.equal(readCjObservation(raw.replace('"quantity":2','"quantity":null'),{productId:PID,vid:VID,nowMs:NOW}).fresh,false);
});

test("observer is lease-protected, writes only ephemeral snapshots, never changes catalog",async()=>{
 const kv=new Map(),writes=[],queries=[];
 const deps={
   listProducts:async()=>[product],
   read:async k=>kv.get(k)||null,
   upsert:async(k,v)=>{kv.set(k,v);writes.push(k);},
   mutate:async(k,fn)=>kv.set(k,await fn(kv.get(k)||null)),
   queryStock:async input=>{queries.push(input);return {verified:true,vid:VID,origin:"CN",quantity:6,available:true};},
   now:()=>NOW,
 };
 const worker=createCjStockObserver(deps),result=await worker.sweep();
 assert.equal(result.status,"complete");
 assert.equal(result.verified,1);
 assert.deepEqual(queries,[{vid:VID,origin:"CN"}]);
 const stock=readCjObservation(kv.get(cjObservationKey(PID,VID)),{productId:PID,vid:VID,nowMs:NOW});
 assert.equal(stock.quantity,6);
 assert.ok(writes.every(key=>key.startsWith("cjStockObservation:") || key.startsWith("cjStockObserverCursor:")));
 const other=createCjStockObserver({...deps,
   mutate:async(k,fn)=>kv.set(k,await fn(JSON.stringify({owner:"other",expiresAt:NOW+100_000})))});
 const locked=await other.sweep();
 assert.equal(locked.status,"another_worker");
});

test("unverified CN warehouse does not become fake zero stock and produces a diagnostic",async()=>{
 const kv=new Map(),warnings=[];
 const worker=createCjStockObserver({
  listProducts:async()=>[product],
  read:async k=>kv.get(k)||null,
  upsert:async(k,v)=>kv.set(k,v),
  mutate:async(k,fn)=>kv.set(k,await fn(kv.get(k)||null)),
  queryStock:async()=>({available:false,quantity:0,verified:false}),
  now:()=>NOW,logger:{warn:(message,detail)=>warnings.push({message,detail})},
 });
 const result=await worker.sweep();
 assert.equal(result.invalid,1);
 assert.equal(result.outOfStock,0);
 assert.equal(result.verified,0);
 assert.equal(kv.has(cjObservationKey(PID,VID)),false);
 assert.equal(warnings[0].detail.reason,"UNVERIFIED_CN_STOCK");
});

test("quota stop never fabricates stock and returns a bounded batch",async()=>{
 const kv=new Map();
 const worker=createCjStockObserver({
  listProducts:async()=>[product],
  read:async k=>kv.get(k)||null,
  upsert:async(k,v)=>kv.set(k,v),
  mutate:async(k,fn)=>kv.set(k,await fn(kv.get(k)||null)),
  queryStock:async()=>{const e=new Error("rate limited");e.code="CJ_RATE_LIMITED";throw e;},
  now:()=>NOW,maxPerSweep:999,
 });
 const result=await worker.sweep();
 assert.equal(result.status,"rate_limited");
 assert.equal(result.inspected,1);
 assert.equal(kv.has(cjObservationKey(PID,VID)),false);
});

test("frontend and backend never use cached observations to authorize purchases",()=>{
 const gateway=readFileSync(new URL("./neonGateway.js",import.meta.url),"utf8");
 const checkout=readFileSync(new URL("./cjCheckoutSafety.js",import.meta.url),"utf8");
 const storefront=readFileSync(new URL("../src/app/pages/ProductDetail.tsx",import.meta.url),"utf8");
 const start=gateway.indexOf('if(path==="/api/commerce/cj-availability"');
 const end=gateway.indexOf('if(path==="/api/commerce/products"',start);
 assert.ok(start>0 && end>start);
 const handler=gateway.slice(start,end);
 assert.match(handler,/readNeonStorageValue\(cjObservationKey/);
 assert.doesNotMatch(handler,/queryCjVariantStock|createOrderV2|payBalance|saveNeonCommerceProduct/);
 assert.match(storefront,/getCjPublicAvailability/);
 assert.match(storefront,/!cjAvailability\?\.fresh/);
 assert.match(checkout,/queryCjVariantStock/);
 assert.doesNotMatch(checkout,/readCjObservation|cjStockObserver/);
});

test("background observer independently checks verified factory supply and leaves merchant stock unchanged",async()=>{
 const kv=new Map(),asked=[];
 const withSource={...product,metadata:{...product.metadata,
   sourceProductUrl:"https://cjdropshipping.com/product-p-"+PID+".html"}};
 const worker=createCjStockObserver({
   listProducts:async()=>[withSource],
   read:async k=>kv.get(k)||null,
   upsert:async(k,v)=>kv.set(k,v),
   mutate:async(k,fn)=>kv.set(k,await fn(kv.get(k)||null)),
   queryStock:async()=>({verified:true,available:false,quantity:0,vid:VID,origin:"CN"}),
   querySupply:async args=>{asked.push(args);return {
     source:"cj_api",mode:"factory",verified:true,available:true,quantity:11,vid:VID,origin:"CN",
   };},
   now:()=>NOW,
 });
 const result=await worker.sweep();
 assert.equal(result.factoryVerified,1);
 assert.deepEqual(asked,[{pid:PID,vid:VID,origin:"CN"}]);
 const warehouse=readCjObservation(kv.get(cjObservationKey(PID,VID)),{productId:PID,vid:VID,nowMs:NOW});
 const supplier=readCjFactoryObservation(kv.get(cjFactoryObservationKey(PID,VID)),{productId:PID,vid:VID,nowMs:NOW});
 assert.equal(warehouse.quantity,0);
 assert.equal(warehouse.available,false);
 assert.equal(supplier.quantity,11);
 assert.equal(supplier.available,true);
 assert.equal(supplier.notReserved,true);
 assert.equal([...kv.keys()].some(k=>k==="commerceProducts"||k==="posOperations"),false);
});
test("factory inventory declared but unverified never becomes public availability",async()=>{
 const kv=new Map();
 const worker=createCjStockObserver({
   listProducts:async()=>[{...product,metadata:{...product.metadata,
     sourceProductUrl:"https://cjdropshipping.com/product-p-"+PID+".html"}}],
   read:async k=>kv.get(k)||null,
   upsert:async(k,v)=>kv.set(k,v),
   mutate:async(k,fn)=>kv.set(k,await fn(kv.get(k)||null)),
   queryStock:async()=>({verified:false,available:false,quantity:0,reason:"UNVERIFIED_STOCK"}),
   querySupply:async()=>({source:"cj_api",mode:"factory",verified:false,available:false,
     quantity:null,reportedQuantity:5000,vid:VID,origin:"CN"}),
   now:()=>NOW,logger:{warn(){}},
 });
 const result=await worker.sweep();
 assert.equal(result.factoryVerified,0);
 assert.equal(kv.has(cjFactoryObservationKey(PID,VID)),false);
 const gateway=readFileSync(new URL("./neonGateway.js",import.meta.url),"utf8");
 const route=gateway.slice(gateway.indexOf('if(path==="/api/commerce/cj-availability"'),
   gateway.indexOf('if(path==="/api/commerce/products"'));
 assert.match(route,/readCjFactoryObservation/);
 assert.doesNotMatch(route,/queryCjFactorySupply|createOrderV2|payBalance/);
});
