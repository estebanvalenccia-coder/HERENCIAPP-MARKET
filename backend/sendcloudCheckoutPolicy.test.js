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
 assert.equal(verified3DParcel({items:[{id:"3d1",quantity:2}],catalog:[product],settings}).parcel.length,62);
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
test("A whole cart of non-living owned goods can share a conservative packed box",()=>{
 const item={id:"g",category:"herramientas",type:"decor",name:"Regadera",metadata:{weight:"200 g",dimensions:"10 × 8 × 8 cm"}};
 const q=verified3DParcel({items:[{id:"3d1",quantity:1},{id:"g",quantity:2}],catalog:[product,item],settings});
 assert.equal(q.parcel.length,52);
 assert.equal(q.parcel.width,22);
 assert.equal(q.parcel.weight,1.1);
 assert.equal(verified3DParcel({items:[{id:"3d1",quantity:1},{id:"p",quantity:1}],catalog:[product,
  {id:"p",type:"plant",category:"plantas-interior",metadata:{weight:"1 kg",dimensions:"20 x 20 x 20"}}],settings}),null);
 assert.equal(verified3DParcel({items:[{id:"g",quantity:15}],catalog:[item],settings}),null);
});
test("never use unverified or non-EUR quotes",()=>{
 const quotes=[{code:"a",price:3.5,currency:"EUR"},{code:"b",price:null,currency:null},{code:"c",price:1,currency:"USD"}];
 assert.equal(offeredShippingOption(quotes,{method:"sendcloud",optionCode:"a"}).price,3.5);
 for(const id of ["b","c","d"])assert.equal(offeredShippingOption(quotes,{method:"sendcloud",optionCode:id}),null);
});

test("shipping quotes use measured outer packaging and total parcel weight before product display dimensions",()=>{
 const p={...product,metadata:{
  dimensions:"10 x 10 x 10 cm",weight:"150 g",
  shippingDimensions:"35 × 25 × 20 cm",shippingWeight:"1.2 kg",
 }};
 const result=verified3DParcel({items:[{id:"3d1",quantity:1}],catalog:[p],settings});
 assert.deepEqual([result.parcel.length,result.parcel.width,result.parcel.height],[35,25,20]);
 assert.equal(result.parcel.weight,1.2);
 assert.equal(verified3DParcel({items:[{id:"3d1",quantity:1}],
  catalog:[{...p,metadata:{...p.metadata,shippingWeight:"0 kg"}}],settings}),null);
});
