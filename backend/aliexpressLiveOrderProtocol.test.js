import test from "node:test";
import assert from "node:assert/strict";
import {
  AE_BUY_METHOD,AE_FREIGHT_METHOD,
  buildAliExpressFreightQuery,parseAliExpressFreightResponse,
  buildAliExpressUnpaidOrderRequest,parseAliExpressUnpaidCreation,
  assertAliExpressFundedOrder
} from "./aliexpressLiveOrderProtocol.js";
const address={country:"ES",postalCode:"08032",city:"Barcelona",province:"Barcelona",street:"Carrer example 1",recipient:"Person One",phone:"612345678"};
const order={id:"order-uuid",status:"paid",total:30,stripe_payment_intent_id:"pi_approved",payment_method:"card",metadata:{}};
const fulfillment={orderId:"order-uuid",externalOrderId:"",status:"autopilot_ready"};
test("Official AE order and freight API methods are explicit",()=>{
 assert.equal(AE_BUY_METHOD,"aliexpress.trade.buy.placeorder");
 assert.equal(AE_FREIGHT_METHOD,"aliexpress.logistics.buyer.freight.get");
});
test("Build an unpaid purchase with exact variant and address",()=>{
 const args=buildAliExpressUnpaidOrderRequest({productId:"1005012816873918",skuAttr:"14:200004891#red",logisticsServiceName:"AliExpress Standard Shipping",address});
 const payload=JSON.parse(args.param_place_order_request4_open_api_d_t_o);
 assert.equal(payload.product_items[0].sku_attr,"14:200004891#red");
 assert.equal(payload.logistics_address.country,"ES");
 assert.equal(payload.product_items[0].product_count,1);
});
test("Reject invalid address, variants, non-ES destinations and batch orders",()=>{
 const base={productId:"1005012816873918",skuAttr:"14:200004891#red",logisticsServiceName:"AE Standard",address};
 assert.throws(()=>buildAliExpressUnpaidOrderRequest({...base,skuAttr:""}));
 assert.throws(()=>buildAliExpressUnpaidOrderRequest({...base,quantity:2}));
 assert.throws(()=>buildAliExpressUnpaidOrderRequest({...base,address:{...address,country:"US"}}));
 assert.throws(()=>buildAliExpressFreightQuery({productId:base.productId,skuId:base.skuAttr,country:"US"}));
});
test("Accept only provider response proving ONE real order",()=>{
 const response={aliexpress_trade_buy_placeorder_response:{result:{is_success:true,order_list:{number:[8207144545095178]}}}};
 assert.equal(parseAliExpressUnpaidCreation(response).externalOrderId,"8207144545095178");
 assert.throws(()=>parseAliExpressUnpaidCreation({aliexpress_trade_buy_placeorder_response:{result:{is_success:false,order_list:{number:[8207144545095178]}}}}));
 assert.throws(()=>parseAliExpressUnpaidCreation({aliexpress_trade_buy_placeorder_response:{result:{is_success:true,order_list:{number:[]}}}}));
});
test("Only EUR freight with actual service and nonnegative price is accepted",()=>{
 const response={aliexpress_logistics_buyer_freight_get_response:{result:{success:true,aeop_freight_calculate_result_for_buyer_dtolist:[
   {service_name:"AliExpress Standard",freight:{currency_code:"EUR",amount:2.35},error_code:0},
   {service_name:"Invalid Currency",freight:{currency_code:"USD",amount:1},error_code:0}
 ]}}};
 const results=parseAliExpressFreightResponse(response);
 assert.equal(results.length,1);
 assert.equal(results[0].shippingCostEur,2.35);
});
test("Paid order gate refuses coupon-funded and duplicate attempts",()=>{
 assert.equal(assertAliExpressFundedOrder(order,fulfillment),true);
 for(const changed of [
   {...order,total:0,metadata:{freeCouponOrder:true}},
   {...order,status:"pending"},
   {...order,stripe_payment_intent_id:null},
 ])assert.throws(()=>assertAliExpressFundedOrder(changed,fulfillment));
 assert.throws(()=>assertAliExpressFundedOrder(order,{...fulfillment,externalOrderId:"8207144545095178"}));
});
