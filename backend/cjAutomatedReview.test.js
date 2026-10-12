import test from "node:test";
import assert from "node:assert/strict";
import {assessCjAutomatedProduct,summarizeCjProductReviews} from "./cjAutomatedReview.js";
const base={id:"1",name:"Bolsa",status:"draft",sku:"CJ-SKU",
 metadata:{fulfillmentType:"dropship",sourceHost:"cjdropshipping.com"}};
test("unknown CJ facts are pending, never declared a confirmed violation",()=>{
 const a=assessCjAutomatedProduct(base);
 assert.equal(a.state,"pending");
 assert.equal(a.confirmed.length,0);
 assert.ok(a.pending.some(x=>x.includes("fabricante")));
 assert.ok(a.pending.some(x=>x.includes("Stock")));
});
test("confirmed unavailable shipping or stock blocks sales",()=>{
 const a=assessCjAutomatedProduct(base,{shipping:{verified:true,available:false}});
 assert.equal(a.state,"blocked");
 assert.ok(a.confirmed.some(x=>x.includes("transporte")));
});
test("archived products do not become eligible by missing observation",()=>{
 assert.equal(assessCjAutomatedProduct({...base,status:"archived"}).state,"blocked");
});
test("non CJ provider is not audited as CJ",()=>{
 const m={...base,metadata:{fulfillmentType:"dropship",sourceHost:"printful.com"}};
 assert.equal(assessCjAutomatedProduct(m).applicable,false);
 assert.equal(summarizeCjProductReviews([base,m]).total,1);
});
test("verified readiness still requires compliance documents",()=>{
 const result=assessCjAutomatedProduct(base,{shipping:{verified:true,available:true},
   stock:{verified:true,available:true},price:{verified:true}});
 assert.equal(result.state,"pending");
});
