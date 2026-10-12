import test from "node:test";
import assert from "node:assert/strict";
import {preparePrintfulDraft,lookupPrintfulOrder,createPrintfulDraft,confirmPrintfulDraft,estimatePrintfulOrder,normalizePrintfulEstimate} from "./printfulOrderFulfillment.js";
const product={id:"p1",name:"Camisa jungle",metadata:{provider:"printful"},
 variants:[{name:"Negro / M",printfulSyncVariantId:"123456",printfulCatalogVariantId:"2020",printfulAvailability:"active",sku:"NJ-M"}]};
const order={id:"dddddddd-0000-4000-8000-000000000001",status:"paid",items:[{id:"p1",selectedVariant:"Negro / M",quantity:1,printfulSyncVariantId:"123456"}],
 customer_email:"example@example.com",customer_name:"Buyer",metadata:{shippingAddress:{address:"Calle Falsa 20",postalCode:"08032",city:"Barcelona",country:"ES"}}};
test("confirmed Herencia order uses Printful synced variant ID and deterministic external reference",()=>{
 const p=preparePrintfulDraft(order,[product]);
 assert.equal(p.external_id,"HERENCIA-"+order.id);
 assert.deepEqual(p.items,[{sync_variant_id:123456,quantity:1}]);
 assert.equal(p.recipient.country_code,"ES");
});
test("unknown size color or a stale cart identity cannot dispatch",()=>{
 assert.throws(()=>preparePrintfulDraft({...order,items:[{id:"p1",selectedVariant:"Negro / XL",quantity:1}]},[product]),/variante/i);
 assert.throws(()=>preparePrintfulDraft({...order,items:[{id:"p1",selectedVariant:"Negro / M",quantity:1,printfulSyncVariantId:"12"}]},[product]),/no coincide/);
});
test("no sending unpaid, mixed supplier or missing address orders",()=>{
 assert.throws(()=>preparePrintfulDraft({...order,status:"pending"},[product]),/confirmado/);
 assert.throws(()=>preparePrintfulDraft({...order,items:[...order.items,{id:"cj",quantity:1}]},[product]),/ajeno/);
 assert.throws(()=>preparePrintfulDraft({...order,metadata:{}},[product]),/dirección/);
});
test("GET external ID reconciliation can confirm exact Printful status",async()=>{
 const calls=[];const f=async(url,req)=>{calls.push([url,req]);return {ok:true,status:200,json:async()=>({result:{id:893,status:"draft",external_id:"HERENCIA-"+order.id}})}};
 const o=await lookupPrintfulOrder(order.id,{env:{PRINTFUL_API_TOKEN:"secret",PRINTFUL_STORE_ID:"52"},fetchImpl:f});
 assert.equal(o.id,"893");assert.equal(o.status,"draft");
 assert.equal(calls[0][1].headers["X-PF-Store-Id"],"52");
 assert.equal(calls[0][0].split("/orders/")[1],"@HERENCIA-"+order.id);
});
test("create remains draft: no confirm query parameter or money charging endpoint",async()=>{
 const payload=preparePrintfulDraft(order,[product]);let seen;
 const r=await createPrintfulDraft(payload,{env:{PRINTFUL_API_TOKEN:"secret"},fetchImpl:async(url,req)=>{
 seen={url,req};return {ok:true,status:200,json:async()=>({result:{id:987,status:"draft",external_id:payload.external_id}})}
 }});
 assert.equal(r.id,"987");
 assert.equal(seen.req.method,"POST");assert.equal(seen.url,"https://api.printful.com/orders");
 assert.deepEqual(JSON.parse(seen.req.body).items,payload.items);
});
test("401 429 and transport uncertainty fail without declaring a supplier order",async()=>{
 const env={PRINTFUL_API_TOKEN:"secret"};
 await assert.rejects(lookupPrintfulOrder(order.id,{env,fetchImpl:async()=>({status:403,ok:false})}),/token/);
 await assert.rejects(lookupPrintfulOrder(order.id,{env,fetchImpl:async()=>({status:429,ok:false})}),/limitado/);
 await assert.rejects(createPrintfulDraft(preparePrintfulDraft(order,[product]),{env,fetchImpl:async()=>{throw Error("timeout")}}),/incierto/);
});

test("Printful supplier estimate includes authoritative currency, shipping and tax",async()=>{
 const env={PRINTFUL_API_TOKEN:"secret",PRINTFUL_STORE_ID:"42"};
 const payload=preparePrintfulDraft(order,[product]);
 const calls=[];
 const quote=await estimatePrintfulOrder(payload,{env,fetchImpl:async(url,req)=>{
   calls.push({url,req});
   return {ok:true,status:200,json:async()=>({result:{costs:{currency:"EUR",total:"25.49",subtotal:"18.00",shipping:"5.49",vat:"2.00"}}})};
 }});
 assert.equal(quote.total,25.49);
 assert.equal(quote.currency,"EUR");
 assert.equal(quote.breakdown.shipping,5.49);
 assert.equal(calls[0].url,"https://api.printful.com/orders/estimate-costs");
 assert.equal(calls[0].req.headers["X-PF-Store-Id"],"42");
});
test("Printful estimates reject missing money, currency and temporary API failures",async()=>{
 assert.throws(()=>normalizePrintfulEstimate({result:{costs:{total:21}}}),/moneda/);
 assert.throws(()=>normalizePrintfulEstimate({result:{costs:{total:"n/a",currency:"USD"}}}),/moneda/);
 await assert.rejects(estimatePrintfulOrder(preparePrintfulDraft(order,[product]),{
   env:{PRINTFUL_API_TOKEN:"secret"},fetchImpl:async()=>({ok:false,status:403})
 }),/token/);
});

test("live confirmation is a dedicated guarded action with exact provider identity",async()=>{
 let calls=0;
 const result=await confirmPrintfulDraft("987",{env:{PRINTFUL_API_TOKEN:"secret",PRINTFUL_STORE_ID:"52"},fetchImpl:async(url,options)=>{
   calls++;
   assert.equal(url,"https://api.printful.com/orders/987/confirm");
   assert.equal(options.method,"POST");
   assert.equal(options.headers["X-PF-Store-Id"],"52");
   return {ok:true,status:200,json:async()=>({result:{id:987,status:"pending",external_id:"HERENCIA-"+order.id}})};
 }});
 assert.equal(calls,1);
 assert.equal(result.status,"pending");
 await assert.rejects(confirmPrintfulDraft("@HERENCIA-evil",{env:{PRINTFUL_API_TOKEN:"secret"}}),/inválido/);
 await assert.rejects(confirmPrintfulDraft("987",{env:{PRINTFUL_API_TOKEN:"secret"},fetchImpl:async()=>{throw Error("timeout")}}),/incierta/);
});
