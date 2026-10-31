import test from "node:test";
import assert from "node:assert/strict";
import {is3DShippingProduct,verified3DParcel,offeredShippingOption} from "./sendcloudCheckoutPolicy.js";
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
test("live Neon Commerce 3D category is eligible after real measurements, but potted plants are never eligible",()=>{
 const neonProduct={id:"3d1",category:"macetas-3d",type:"decor",name:"Jarrón naranja escultórico",
   collections:["decoracion"],metadata:{weight:"500 g",dimensions:"30 × 20 × 10 cm"}};
 assert.equal(is3DShippingProduct(neonProduct),true);
 const quote=verified3DParcel({items:[{id:"3d1",quantity:1}],catalog:[neonProduct],settings});
 assert.equal(quote.parcel.weight,0.5);
 const plant={...neonProduct,name:"Planta de Ají con maceta"};
 assert.equal(is3DShippingProduct(plant),false);
 assert.equal(verified3DParcel({items:[{id:"3d1",quantity:1}],catalog:[plant],settings}),null);
 assert.equal(is3DShippingProduct({...neonProduct,type:"plant"}),false);
 assert.equal(is3DShippingProduct({...neonProduct,metadata:{...neonProduct.metadata,containsLivePlant:true}}),false);
 assert.equal(is3DShippingProduct({...neonProduct,category:"plantas-interior"}),false);
});
test("never use unverified or non-EUR quotes",()=>{
 const quotes=[{code:"a",price:3.5,currency:"EUR"},{code:"b",price:null,currency:null},{code:"c",price:1,currency:"USD"}];
 assert.equal(offeredShippingOption(quotes,{method:"sendcloud",optionCode:"a"}).price,3.5);
 for(const id of ["b","c","d"])assert.equal(offeredShippingOption(quotes,{method:"sendcloud",optionCode:id}),null);
});
