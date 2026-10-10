import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  printfulConnectionStatus, validatePrintfulShippingInput,
  normalizePrintfulShippingResponse, quotePrintfulShipping,
} from "./printfulShippingQuotes.js";

const params = {catalogVariantId: 4011, destination:"FR", postalCode:"75001"};
const mockRates = { data:[
  {shipping:"EXPRESS",shipping_method_name:"Express",rate:"12.90",currency:"EUR",
    min_delivery_days:2,max_delivery_days:4,shipments:[{customs_fees_possible:true}]},
  {shipping:"STANDARD",shipping_method_name:"Estándar",rate:"4.79",currency:"EUR",
    min_delivery_days:5,max_delivery_days:8,shipments:[{customs_fees_possible:false}]},
]};
test("server credentials are necessary but never authorize purchases", () => {
  assert.equal(printfulConnectionStatus({}).configured,false);
  assert.equal(printfulConnectionStatus({PRINTFUL_API_TOKEN:"token"}).configured,true);
  assert.equal(printfulConnectionStatus({PRINTFUL_API_TOKEN:"token",PRINTFUL_STORE_ID:"abc"}).configured,false);
  assert.equal(printfulConnectionStatus({PRINTFUL_API_TOKEN:"token"}).automaticOrders,false);
});
test("catalog variant, one unit, postal code and EU destination are mandatory",()=>{
  assert.deepEqual(validatePrintfulShippingInput(params),{
    catalogVariantId:4011,destination:"FR",postalCode:"75001",quantity:1,currency:"EUR",
  });
  for (const other of [
    {...params,catalogVariantId:"4011<script>"}, {...params,catalogVariantId:0},
    {...params,destination:"US"}, {...params,postalCode:""},
    {...params,postalCode:"<script>"}, {...params,quantity:2},
    {...params,destination:"ES",postalCode:"1234"}
  ]) assert.throws(()=>validatePrintfulShippingInput(other));
});
test("rates are sorted, explicitly EUR, cannot be promoted to supplier cost or checkout",()=>{
  const rates=normalizePrintfulShippingResponse(params,mockRates,"2026-10-10T13:30:00.000Z");
  assert.equal(rates.provider,"printful");
  assert.equal(rates.methods[0].rateEur,4.79);
  assert.equal(rates.methods[1].customsFeesPossible,true);
  assert.equal(rates.quantity,1);
  assert.equal(rates.supplierProductPriceVerified,false);
  assert.equal(rates.supplierStockVerified,false);
  assert.equal(rates.checkoutEnabled,false);
  assert.equal(rates.automaticOrdersEnabled,false);
});
test("invalid or USD-only provider rates cannot masquerade as EUR quotes",()=>{
  assert.throws(()=>normalizePrintfulShippingResponse(params,{data:[{shipping:"X",currency:"USD",rate:"4.79"}]}),/EUR/);
  assert.throws(()=>normalizePrintfulShippingResponse(params,{data:[{shipping:"X",currency:"EUR",rate:"not-money"}]}),/EUR/);
  assert.throws(()=>normalizePrintfulShippingResponse(params,{}),/métodos/);
});
test("official shipping endpoint receives only country, ZIP, product variant and one unit",async()=>{
  let calls=0;
  const fakeFetch=async(url,options)=>{
    calls++;
    assert.equal(url,"https://api.printful.com/v2/shipping-rates");
    assert.equal(options.method,"POST");
    assert.equal(options.redirect,"error");
    assert.equal(options.headers.Authorization,"Bearer server-secret");
    assert.equal(options.headers["X-PF-Store-Id"],"123456");
    assert.deepEqual(JSON.parse(options.body),{
      recipient:{country_code:"FR",zip:"75001"},
      order_items:[{source:"catalog",quantity:1,catalog_variant_id:4011}],
      currency:"EUR",
    });
    assert.equal(options.body.includes("server-secret"),false);
    assert.equal(options.body.includes("email"),false);
    return {ok:true,status:200,json:async()=>mockRates};
  };
  const result=await quotePrintfulShipping(params,{
    env:{PRINTFUL_API_TOKEN:"server-secret",PRINTFUL_STORE_ID:"123456"},
    fetchImpl:fakeFetch,now:()=>new Date("2026-10-10T13:30:00.000Z"),
  });
  assert.equal(calls,1);
  assert.equal(result.checkedAt,"2026-10-10T13:30:00.000Z");
  assert.equal(JSON.stringify(result).includes("server-secret"),false);
});
test("without credentials, invalid input or auth failure, the connector fails closed",async()=>{
  let attempts=0;
  const fakeFetch=async()=>{attempts++;return {status:401,ok:false}};
  await assert.rejects(quotePrintfulShipping(params,{env:{},fetchImpl:fakeFetch}),/PRINTFUL_API_TOKEN/);
  await assert.rejects(quotePrintfulShipping({...params,quantity:10},{
    env:{PRINTFUL_API_TOKEN:"secret"},fetchImpl:fakeFetch}),/unidad/);
  assert.equal(attempts,0);
  await assert.rejects(quotePrintfulShipping(params,{
    env:{PRINTFUL_API_TOKEN:"secret"},fetchImpl:fakeFetch}),/token o sus permisos/);
});
test("gateway always authenticates Printful routes and never sends an order",()=>{
  const gateway=readFileSync(new URL("./neonGateway.js",import.meta.url),"utf8");
  const start=gateway.indexOf('if(path==="/api/admin/suppliers/printful/status"');
  const end=gateway.indexOf('if(path==="/api/admin/catalog/cj-freight"',start);
  assert.ok(start>0&&end>start);
  const section=gateway.slice(start,end);
  assert.match(section,/adminSession\(req\)/);
  assert.match(section,/quotePrintfulShipping/);
  assert.doesNotMatch(section,/createOrderV2|paymentIntents|payBalance|\/v2\/orders/);
});
