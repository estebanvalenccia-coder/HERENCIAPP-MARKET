import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCjCheckout } from "./cjCheckoutSafety.js";

const cj={id:"cj-product",name:"Garden irrigation controller",price:20,metadata:{
  fulfillmentType:"dropship",sourceHost:"cjdropshipping.com",supplierId:"cj-supplier",
  supplierVariantId:"1531107375489495040",supplierSku:"CJJZGJYL00285-Green EU Plug",
  cjPreferredLogisticName:"CJPacket Liquid Line",
  sourceProductUrl:"https://cjdropshipping.com/product-p-1531107375489495040.html",
  gpsrManufacturerName:"Fabricante CJ",gpsrManufacturerPostalAddress:"Shanghai, China",
  gpsrManufacturerEmail:"supplier@example.com",gpsrManufacturerCountryCode:"CN",
  gpsrEuResponsibleName:"Responsable UE",gpsrEuResponsiblePostalAddress:"Madrid, España",
  gpsrEuResponsibleEmail:"responsable@example.es",gpsrNoWarningsApplicable:true,
  gpsrSafetyReviewed:true,cjImportArrangement:"DDP",cjImportCostsReviewed:true,cjAdditionalImportCostEur:3,
}};
const supplier={id:"cj-supplier",name:"CJdropshipping",integrationType:"cj",active:true,cjSandbox:false};
test("CJ supplier in Sandbox blocks checkout before contacting CJ or preparing Stripe",async()=>{
  let calls=0;
  const deps={
    verifyVariant:async()=>{calls++;throw Error("Should not call CJ");},
    quoteShipping:async()=>{calls++;throw Error("Should not quote");},
    getRate:async()=>{calls++;throw Error("Should not fetch FX");},
    getStock:async()=>{calls++;throw Error("Should not fetch stock");},
  };
  await assert.rejects(evaluateCjCheckout({
    lines:[{id:"cj-product",quantity:1,price:20}],catalog:[cj],
    suppliers:[{...supplier,cjSandbox:true}],shippingAddress:{country:"ES",postalCode:"08032"},
    deps,
  }),/modo de pruebas.*No se realizará ningún cobro/);
  await assert.rejects(evaluateCjCheckout({
    lines:[{id:"cj-product",quantity:1,price:20}],catalog:[cj],
    suppliers:[{id:"cj-supplier",integrationType:"cj",active:true}],
    shippingAddress:{country:"ES",postalCode:"08032"},deps,
  }),/Sandbox/);
  assert.equal(calls,0);
});

test("CJ checkout rejects missing legal identity or customs verification before API calls",async()=>{
 let called=0;
 const deps={verifyVariant:async()=>{called++;throw Error("CJ called");},
 quoteShipping:async()=>{called++;throw Error("Shipping called");},
 getRate:async()=>{called++;throw Error("FX called");},getStock:async()=>{called++;throw Error("Stock called");}};
 for(const metadata of [{...cj.metadata,gpsrManufacturerName:""}, {...cj.metadata,cjImportCostsReviewed:false}]){
  await assert.rejects(evaluateCjCheckout({lines:[{id:"cj-product",price:20,quantity:1}],
    catalog:[{...cj,metadata}],suppliers:[supplier],
    shippingAddress:{country:"ES",postalCode:"08032"},deps}),/seguridad y aduanas.*No se realizará ningún cobro/);
 }
 assert.equal(called,0);
});

test("ordinary Herencia goods keep their original local shipping checkout", async () => {
  const r=await evaluateCjCheckout({lines:[{id:"flower",quantity:1,price:10}],catalog:[{id:"flower",name:"Plant"}]});
  assert.equal(r.cjOnly,false);
});
test("CJ and local items cannot be mis-shipped together",async()=>{
  await assert.rejects(evaluateCjCheckout({
    lines:[{id:"cj-product",quantity:1,price:20},{id:"flower",quantity:1,price:10}],
    catalog:[cj,{id:"flower",name:"Plant"}],
  }),/pedidos separados/);
});
test("CJ checkout rejects unsupported destinations before any CJ API call",async()=>{
  await assert.rejects(evaluateCjCheckout({
    lines:[{id:"cj-product",quantity:1,price:20}],catalog:[cj],
    suppliers:[supplier],shippingAddress:{country:"US",postalCode:"10001"},
  }),/España/);
});
test("CJ checkout rejects unknown postal codes without charging",async()=>{
  await assert.rejects(evaluateCjCheckout({
    lines:[{id:"cj-product",quantity:1,price:20}],catalog:[cj],
    suppliers:[supplier],shippingAddress:{country:"España",postalCode:""},
  }),/código postal/);
});
test("CJ checkout does not use one-unit freight quotes for quantities larger than one",async()=>{
  await assert.rejects(evaluateCjCheckout({
    lines:[{id:"cj-product",quantity:2,price:20}],catalog:[cj],
    suppliers:[supplier],shippingAddress:{country:"ES",postalCode:"28001"},
  }),/una unidad/);
});

// Frontend uses public catalog metadata because older cart snapshots can omit CJ fields.
import { enrichCartWithCatalog, isCjSupplierItem } from "../src/app/lib/cjFulfillmentIdentity.js";
test("checkout identifies CJ using authoritative public catalog metadata, not a stale cart snapshot", () => {
  const cart = [{ id: "cj-product", name: "Garden irrigation controller", price: 20, quantity: 1 }];
  assert.equal(isCjSupplierItem(cart[0]), false);
  const enriched = enrichCartWithCatalog(cart, [cj]);
  assert.equal(isCjSupplierItem(enriched[0]), true);
  assert.equal(enriched[0].price, 20);
});
test("checkout does not confuse Herencia delivery with CJ fulfillment", () => {
  const cart = [{ id: "flower", name: "Plant", quantity: 1, metadata: { fulfillmentType: "dropship", sourceHost: "cjdropshipping.com" } }];
  const enriched = enrichCartWithCatalog(cart, [{ id: "flower", name: "Plant", metadata: {} }]);
  assert.equal(isCjSupplierItem(enriched[0]), false);
});

test("CJ checkout quotes exact blue US variant, never product default", async () => {
  const variant={name:"Azul · US Plug",supplierVariantId:"1531107375489495051",
    supplierSku:"CJJZGJYL00285-Blue US Plug"};
  const product={...cj,variants:[
    {name:"Rosa · EU Plug",supplierVariantId:"1531107375489495040",
      supplierSku:"CJJZGJYL00285-Green EU Plug"},variant
  ]};
  const seen=[];
  const deps={
    verifyVariant:async({vid})=>{seen.push("verify:"+vid);return {vid,sku:variant.supplierSku,priceUsd:5};},
    quoteShipping:async({vid,zip})=>{seen.push("shipping:"+vid+":"+zip);
      return {vid,zip,destination:"ES",methods:[{name:"CJPacket Liquid Line",totalPostageUsd:2,time:"5-10 días"}]};},
    getRate:async()=>({rate:0.9}),
    getStock:async({vid})=>({verified:true,available:true,quantity:6,vid,origin:"CN"}),
  };
  const r=await evaluateCjCheckout({lines:[{id:"cj-product",quantity:1,price:20,selectedVariant:variant.name}],
    catalog:[product],suppliers:[supplier],shippingAddress:{country:"ES",postalCode:"08032"},deps});
  assert.equal(r.cjOnly,true);
  assert.equal(r.verifiedQuote.vid,variant.supplierVariantId);
  assert.equal(r.verifiedQuote.sku,variant.supplierSku);
  assert.equal(r.verifiedQuote.postalCode,"08032");
  assert.deepEqual(seen,["verify:"+variant.supplierVariantId,"shipping:"+variant.supplierVariantId+":08032"]);
});
test("CJ wrong VID/SKU, unlisted combination and mismatched freight block checkout",async()=>{
  const product={...cj,variants:[{name:"Rosa · EU Plug",supplierVariantId:"1531107375489495040",supplierSku:"CJJZGJYL00285-Green EU Plug"}]};
  const make=(choice,changes={})=>evaluateCjCheckout({
    lines:[{id:"cj-product",quantity:1,price:20,selectedVariant:choice}],
    catalog:[product],suppliers:[supplier],shippingAddress:{country:"ES",postalCode:"08032"},
    deps:{verifyVariant:async()=>({vid:"1531107375489495040",sku:changes.sku||"wrong",priceUsd:5}),
      quoteShipping:async()=>({vid:changes.vid||"1531107375489495040",
        destination:"ES",zip:"08032",methods:[{name:"CJPacket Liquid Line",totalPostageUsd:2}]}),
      getRate:async()=>({rate:.9}),
      getStock:async({vid})=>({verified:true,available:true,quantity:6,vid,origin:"CN"})},
  });
  await assert.rejects(make("Azul · US Plug"),/no existe/);
  await assert.rejects(make("Rosa · EU Plug"),/SKU exactos/);
  await assert.rejects(make("Rosa · EU Plug",{sku:"CJJZGJYL00285-Green EU Plug",vid:"wrong"}),/no coincide/);
});

test("out-of-stock supplier VID never allows payment despite a valid shipping quote",async()=>{
 const variant={name:"Rosa · EU Plug",supplierVariantId:"1531107375489495040",supplierSku:"CJJZGJYL00285-Green EU Plug"};
 await assert.rejects(evaluateCjCheckout({
  lines:[{id:"cj-product",quantity:1,price:20,selectedVariant:variant.name}],catalog:[{...cj,variants:[variant]}],
  suppliers:[supplier],shippingAddress:{country:"ES",postalCode:"08032"},
  deps:{verifyVariant:async()=>({vid:variant.supplierVariantId,sku:variant.supplierSku,priceUsd:5}),
    quoteShipping:async()=>({vid:variant.supplierVariantId,destination:"ES",zip:"08032",methods:[{name:"CJPacket Liquid Line",totalPostageUsd:2}]}),
    getRate:async()=>({rate:.9}),getStock:async()=>({verified:true,available:false,quantity:0,vid:variant.supplierVariantId,origin:"CN"})}
 }),/no confirmó existencias/);
});

test("CJ dropshipping checkout may source verified EXACT VID factory units without merchant inventory",async()=>{
 const vid="1531107375489495040";
 const deps={
   verifyVariant:async()=>({vid,sku:"CJJZGJYL00285-Green EU Plug",priceUsd:5}),
   quoteShipping:async()=>({vid,origin:"CN",destination:"ES",zip:"08032",methods:[
     {name:"CJPacket Liquid Line",totalPostageUsd:2,shippingUsd:2,time:"5-10"}]}),
   getRate:async()=>({rate:0.9}),
   getStock:async()=>({verified:true,available:false,quantity:0,vid,origin:"CN"}),
   getSupply:async()=>({source:"cj_api",mode:"factory",verified:true,available:true,quantity:6,vid,origin:"CN"}),
 };
 const response=await evaluateCjCheckout({lines:[{id:"cj-product",quantity:1,price:20}],
   catalog:[cj],suppliers:[supplier],shippingAddress:{country:"ES",postalCode:"08032"},deps});
 assert.equal(response.cjOnly,true);
 assert.equal(response.verifiedQuote.supplierSupplyMode,"factory_verified");
 assert.equal(response.verifiedQuote.stockAtQuote,6);
 assert.equal(response.shippingQuote.price,0);
});
test("factory inventory 9000 without verification cannot create a CJ payment path",async()=>{
 const vid="1531107375489495040";
 const deps={
   verifyVariant:async()=>({vid,sku:"CJJZGJYL00285-Green EU Plug",priceUsd:5}),
   quoteShipping:async()=>({vid,origin:"CN",destination:"ES",zip:"08032",methods:[
     {name:"CJPacket Liquid Line",totalPostageUsd:2,shippingUsd:2}]}),
   getRate:async()=>({rate:0.9}),
   getStock:async()=>({verified:true,available:false,quantity:0,vid,origin:"CN"}),
   getSupply:async()=>({source:"cj_api",mode:"factory",verified:false,available:false,reportedQuantity:9000,vid,origin:"CN"}),
 };
 await assert.rejects(evaluateCjCheckout({lines:[{id:"cj-product",quantity:1,price:20}],
   catalog:[cj],suppliers:[supplier],shippingAddress:{country:"ES",postalCode:"08032"},deps}),
   /no confirmó existencias verificadas/);
});

test("CJ checkout automatically selects cheapest verified, margin-positive carrier for exact postcode",async()=>{
 const vid=cj.metadata.supplierVariantId;
 const noPreference={...cj,metadata:{...cj.metadata,cjPreferredLogisticName:""}};
 const deps={
   verifyVariant:async()=>({vid,sku:cj.metadata.supplierSku,priceUsd:5}),
   quoteShipping:async()=>({vid,origin:"CN",destination:"ES",zip:"08032",methods:[
     {name:"Expensive",totalPostageUsd:5,shippingUsd:5},
     {name:"Incomplete",totalPostageUsd:null,shippingUsd:1},
     {name:"Economy",totalPostageUsd:2,shippingUsd:2}]}),
   getRate:async()=>({rate:0.9}),
   getStock:async()=>({verified:true,available:true,quantity:8,vid,origin:"CN"}),
 };
 const result=await evaluateCjCheckout({lines:[{id:cj.id,quantity:1,price:20}],
   catalog:[noPreference],suppliers:[supplier],
   shippingAddress:{country:"ES",postalCode:"08032"},deps});
 assert.equal(result.cjOnly,true);
 assert.equal(result.verifiedQuote.methodName,"Economy");
 assert.equal(result.shippingQuote.logisticName,"Economy");
});
test("CJ checkout never charges using unpriced or unprofitable shipping options",async()=>{
 const vid=cj.metadata.supplierVariantId;
 const deps={
   verifyVariant:async()=>({vid,sku:cj.metadata.supplierSku,priceUsd:5}),
   quoteShipping:async()=>({vid,origin:"CN",destination:"ES",zip:"08032",methods:[
     {name:"Unknown final postage",totalPostageUsd:null,shippingUsd:2},
     {name:"Unaffordable",totalPostageUsd:100,shippingUsd:100}]}),
   getRate:async()=>({rate:0.9}),
   getStock:async()=>({verified:true,available:true,quantity:8,vid,origin:"CN"}),
 };
 await assert.rejects(evaluateCjCheckout({lines:[{id:cj.id,quantity:1,price:20}],
   catalog:[{...cj,metadata:{...cj.metadata,cjPreferredLogisticName:""}}],
   suppliers:[supplier],shippingAddress:{country:"ES",postalCode:"08032"},deps
 }),/transporte con coste completo y margen permitido/);
});

test("CJ exact gardening VID from 202 DE units can checkout only with real DE→ES verified profitable freight",async()=>{
 const vid=cj.metadata.supplierVariantId,called=[];
 const deps={
  verifyVariant:async()=>({vid,sku:cj.metadata.supplierSku,priceUsd:5}),
  getRate:async()=>({rate:.9}),
  getStock:async({origin})=>{called.push("stock:"+origin);return {
    source:"cj_api",verified:origin==="DE",available:origin==="DE",
    quantity:origin==="DE"?202:0,vid,origin,
  };},
  getSupply:async()=>({source:"cj_api",mode:"factory",verified:false,available:false,vid,origin:"CN"}),
  getWarehouses:async()=>({vid,warehouses:[{countryCode:"DE",verified:true,available:true,quantity:202}]}),
  quoteShipping:async({origin,zip})=>{called.push("freight:"+origin+":"+zip);return {
    origin,vid,zip,destination:"ES",
    methods:origin==="DE"?[{name:"Deutsche Post",totalPostageUsd:2,shippingUsd:2,time:"4-8 días"}]:[],
  };},
 };
 const result=await evaluateCjCheckout({lines:[{id:cj.id,quantity:1,price:20}],
  catalog:[cj],suppliers:[supplier],shippingAddress:{country:"ES",postalCode:"08032"},deps});
 assert.equal(result.verifiedQuote.origin,"DE");
 assert.equal(result.verifiedQuote.stockAtQuote,202);
 assert.equal(result.verifiedQuote.supplierSupplyMode,"warehouse");
 assert.equal(result.verifiedQuote.methodName,"Deutsche Post");
 assert.ok(called.includes("stock:DE"));
 assert.ok(called.includes("freight:DE:08032"));
});
test("CJ will not charge with DE units if exact VID stock is unverified or DE→ES freight absent",async()=>{
 const vid=cj.metadata.supplierVariantId;
 const base={
  verifyVariant:async()=>({vid,sku:cj.metadata.supplierSku,priceUsd:5}),
  getRate:async()=>({rate:.9}),
  getStock:async({origin})=>({source:"cj_api",verified:origin==="DE",available:origin==="DE",
    quantity:origin==="DE"?202:0,vid,origin}),
  getSupply:async()=>({source:"cj_api",mode:"factory",verified:false,available:false,vid,origin:"CN"}),
  getWarehouses:async()=>({vid,warehouses:[{countryCode:"DE",verified:true,available:true,quantity:202}]}),
  quoteShipping:async({origin})=>({origin,vid,zip:"08032",destination:"ES",
    methods:origin==="DE"?[{name:"DE route",totalPostageUsd:2,shippingUsd:2}]:[]}),
 };
 const run=(deps)=>evaluateCjCheckout({lines:[{id:cj.id,quantity:1,price:20}],
  catalog:[cj],suppliers:[supplier],shippingAddress:{country:"ES",postalCode:"08032"},deps});
 await assert.rejects(run({...base,getWarehouses:async()=>({vid,warehouses:[
  {countryCode:"DE",verified:false,available:true,quantity:202}]})}),/no confirmó existencias verificadas/);
 await assert.rejects(run({...base,quoteShipping:async({origin})=>({
  origin,vid,zip:"08032",destination:"ES",methods:[]})}),/no confirmó existencias verificadas/);
 await assert.rejects(run({...base,quoteShipping:async({origin})=>({
  origin:"CN",vid,zip:"08032",destination:"ES",
  methods:[{name:"Wrong origin",totalPostageUsd:2,shippingUsd:2}]})}),/no confirmó existencias verificadas/);
 await assert.rejects(run({...base,quoteShipping:async({origin})=>({
  origin,vid,zip:"08032",destination:"ES",
  methods:origin==="DE"?[{name:"Expensive",totalPostageUsd:100,shippingUsd:100}]:[]})}),/no confirmó existencias verificadas/);
});

test("checkout uses live catalog classification for a stale plant cart and preserves price", async () => {
  const { isLivePlant, isCarrierEligibleProduct } = await import("./catalogShippingRules.js");
  const cart = [{ id:"plant123", name:"Maceta", type:"decor", category:"macetas-3d", quantity:1, price:12 }];
  const catalog = [{ id:"plant123", name:"Planta de Ají con maceta", type:"plant", category:"plantas-interior",
    price:18, metadata:{ shippingWeight:"1 kg", shippingDimensions:"20 × 15 × 10 cm" } }];
  const [item] = enrichCartWithCatalog(cart, catalog);
  assert.equal(item.price,12);
  assert.equal(item.quantity,1);
  assert.equal(item.type,"plant");
  assert.equal(isLivePlant(item),true);
  assert.equal(isCarrierEligibleProduct(item),false);
});

test("checkout recognizes current 3D catalog product and preserves selected variant", async () => {
  const { isCarrierEligibleProduct } = await import("./catalogShippingRules.js");
  const cart=[{ id:"pot123", type:"plant", category:"plantas-interior", price:13,
    quantity:1, selectedVariant:"White", metadata:{containsLivePlant:true} }];
  const catalog=[{ id:"pot123", type:"decor", category:"macetas-3d", name:"Maceta blanca minimalista",
    metadata:{shippingWeight:"1 kg",shippingDimensions:"20 × 15 × 10 cm"} }];
  const [item]=enrichCartWithCatalog(cart,catalog);
  assert.equal(item.price,13);
  assert.equal(item.selectedVariant,"White");
  assert.equal(item.type,"decor");
  assert.equal(item.category,"macetas-3d");
  assert.equal(isCarrierEligibleProduct(item),true);
});
