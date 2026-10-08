import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCjCheckout } from "./cjCheckoutSafety.js";

const cj={id:"cj-product",name:"Garden irrigation controller",price:20,metadata:{
  fulfillmentType:"dropship",sourceHost:"cjdropshipping.com",supplierId:"cj-supplier",
  supplierVariantId:"1531107375489495040",supplierSku:"CJJZGJYL00285-Green EU Plug",
  cjPreferredLogisticName:"CJPacket Liquid Line",
}};
const supplier={id:"cj-supplier",name:"CJdropshipping",integrationType:"cj",active:true};
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
