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
