import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isCjSupplierItem, validateCjCartComposition} from "../src/app/lib/cjFulfillmentIdentity.js";
import {interpretCjVariantStock} from "./cjCatalogImporter.js";

const cj={id:"CJ-1",quantity:1,metadata:{sourceHost:"cjdropshipping.com",fulfillmentType:"dropship"}};
const local={id:"LOCAL-1",quantity:1,metadata:{fulfillmentType:"local"}};

test("only one CJ unit can enter checkout; local and services remain unrestricted",()=>{
  assert.equal(isCjSupplierItem(cj),true);
  assert.equal(validateCjCartComposition([cj]).valid,true);
  assert.equal(validateCjCartComposition([local,{...local,id:"LOCAL-2",quantity:9}]).valid,true);
  assert.equal(validateCjCartComposition([{...cj,quantity:2}]).code,"QUANTITY");
  assert.equal(validateCjCartComposition([{...cj,quantity:0}]).code,"QUANTITY");
  assert.equal(validateCjCartComposition([{...cj,quantity:1.5}]).code,"QUANTITY");
  assert.equal(validateCjCartComposition([cj,{...cj,id:"CJ-2"}]).code,"MULTIPLE_CJ");
  assert.equal(validateCjCartComposition([local,cj]).code,"MIXED");
  assert.equal(validateCjCartComposition([cj,local]).code,"MIXED");
});

test("unknown CJ stock cannot be published as a verified zero or available count",()=>{
  for (const row of [
    {vid:"V",countryCode:"CN",storageNum:null},
    {vid:"V",countryCode:"CN",storageNum:""},
    {vid:"V",countryCode:"CN",storageNum:"bad"},
    {vid:"V",countryCode:"CN",storageNum:-1},
    {vid:"V",countryCode:"CN",storageNum:1.5},
  ]){
    const x=interpretCjVariantStock([row],"V","CN");
    assert.equal(x.verified,false);
    assert.equal(x.available,false);
  }
  assert.equal(interpretCjVariantStock([{vid:"V",countryCode:"US",storageNum:200}],"V","CN").verified,false);
  assert.deepEqual(interpretCjVariantStock([{vid:"V",countryCode:"CN",storageNum:0}],"V","CN"),{
    verified:true,quantity:0,available:false,vid:"V",origin:"CN",source:"cj_api"
  });
  assert.equal(interpretCjVariantStock([{vid:"V",countryCode:"CN",storageNum:3}],"V","CN").available,true);
});

test("cart and checkout both reject CJ multi-unit while Stripe still re-quotes backend",()=>{
  const product=readFileSync(new URL("../src/app/pages/ProductDetail.tsx",import.meta.url),"utf8");
  const cart=readFileSync(new URL("../src/app/pages/Cart.tsx",import.meta.url),"utf8");
  const checkout=readFileSync(new URL("../src/app/pages/Checkout.tsx",import.meta.url),"utf8");
  const stripe=readFileSync(new URL("../src/app/components/StripeCheckout.tsx",import.meta.url),"utf8");
  assert.match(product,/isCjProduct && quantity !== 1/);
  assert.match(cart,/validateCjCartComposition\(cartItems\)/);
  assert.match(cart,/disabled=\{isCjSupplierItem\(item\)\}/);
  assert.match(checkout,/validateCjCartComposition\(shippingCartItems\)/);
  assert.match(checkout,/if \(!cjComposition\.valid\)/);
  assert.match(stripe,/paymentIntentResponse\.totals\?\.total/);
});
