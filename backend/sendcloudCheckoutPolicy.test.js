import test from "node:test";
import assert from "node:assert/strict";
import {verified3DParcel,offeredShippingOption} from "./sendcloudCheckoutPolicy.js";
const product={id:"3d1",collection:"creaciones-3d",metadata:{weight:"500 g",dimensions:"30 × 20 × 10 cm"}};
const settings={sendcloud:{checkoutEnabled:true,originPostalCode:"08032"}};
test("only own single 3D product with verified packaging may use Sendcloud",()=>{
 const res=verified3DParcel({items:[{id:"3d1",quantity:1}],catalog:[product],settings});
 assert.equal(res.parcel.weight,0.5);
 assert.deepEqual([res.parcel.length,res.parcel.width,res.parcel.height],[30,20,10]);
 for(const p of [{...product,collection:"plantas"},{...product,metadata:{...product.metadata,provider:"CJ"}}]){
  assert.equal(verified3DParcel({items:[{id:"3d1",quantity:1}],catalog:[p],settings}),null);
 }
 assert.equal(verified3DParcel({items:[{id:"3d1",quantity:2}],catalog:[product],settings}),null);
 assert.equal(verified3DParcel({items:[{id:"3d1",quantity:1}],catalog:[product],settings:{}}),null);
});
test("never use unverified or non-EUR quotes",()=>{
 const quotes=[{code:"a",price:3.5,currency:"EUR"},{code:"b",price:null,currency:null},{code:"c",price:1,currency:"USD"}];
 assert.equal(offeredShippingOption(quotes,{method:"sendcloud",optionCode:"a"}).price,3.5);
 for(const id of ["b","c","d"])assert.equal(offeredShippingOption(quotes,{method:"sendcloud",optionCode:id}),null);
});
