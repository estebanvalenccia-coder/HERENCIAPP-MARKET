/**
 * Official AE dropship buyer-order protocol. Pure validated payload and response
 * parsing; the caller owns authorization, Stripe funding, quote verification,
 * atomic idempotency, and the external HTTP attempt.
 */
const ID=/^[1-9][0-9]{7,21}$/;
const TEXT=/[\x00-\x1f\x7f]/;
const field=(value,max=160)=>String(value??"").trim().slice(0,max);
const fail=(message)=>{const error=new Error(message);error.statusCode=422;throw error;};
export const AE_BUY_METHOD="aliexpress.trade.buy.placeorder";
export const AE_FREIGHT_METHOD="aliexpress.ds.freight.query";
export function buildAliExpressFreightQuery({productId,skuId,quantity=1,country="ES"}) {
  if(!ID.test(String(productId))||!field(skuId,150)||country!=="ES"||quantity!==1)
    fail("Cotización AliExpress: producto, variante, destino o cantidad inválidos.");
  return {aeopFreightCalculateForBuyerDTO:JSON.stringify({
    product_id:Number(productId),product_num:quantity,sku_id:field(skuId,150),
    country_code:"ES",send_goods_country_code:"CN",price_currency:"EUR",
  })};
}
export function parseAliExpressFreightResponse(raw) {
  const root=raw?.aliexpress_ds_freight_query_response?.result ||
    raw?.aliexpress_logistics_buyer_freight_calculate_response?.result;
  if(!root || root.success!==true)fail("AliExpress no confirmó el transporte.");
  const values=root.aeop_freight_calculate_result_for_buyer_d_t_o_list;
  const list=Array.isArray(values)?values:values?.aeop_freight_calculate_result_for_buyer_d_t_o || [];
  const rows=Array.isArray(list)?list:[list];
  return rows.filter(row=>{
    const m=row?.freight;
    return row?.service_name && m?.currency_code==="EUR" &&
      Number.isFinite(Number(m?.amount)) && Number(m.amount)>=0 &&
      row?.error_code===0;
  }).map(row=>({service:field(row.service_name,120),shippingCostEur:Number(row.freight.amount),
    estimatedDelivery:String(row.estimated_delivery_time||"").slice(0,80)}));
}
export function buildAliExpressUnpaidOrderRequest({productId,skuAttr,logisticsServiceName,quantity=1,address}) {
  if(!ID.test(String(productId)))fail("ID de producto AliExpress inválido.");
  const variant=field(skuAttr,150);
  if(!variant || TEXT.test(variant))fail("Falta la variante exacta de AliExpress.");
  const logistics=field(logisticsServiceName,100);
  if(!logistics || TEXT.test(logistics))fail("Falta transporte comprobado.");
  if(quantity!==1)fail("Solo pedidos unitarios verificados.");
  if(!address || address.country!=="ES" ||
      !field(address.postalCode,12) || !field(address.city,120) ||
      !field(address.street,320) || !field(address.recipient,120) ||
      !field(address.phone,40) || !field(address.province,120))fail("Dirección de envío incompleta.");
  const ship={
    address:field(address.street,320),
    city:field(address.city,120),province:field(address.province,120),
    country:"ES",full_name:field(address.recipient,120),
    contact_person:field(address.recipient,120),
    mobile_no:field(address.phone,40),phone_country:"+34",
    zip:field(address.postalCode,12),locale:"es_ES",
  };
  if(address.street2)ship.address2=field(address.street2,160);
  if(Object.values(ship).some(v=>TEXT.test(String(v))))fail("Dirección contiene caracteres de control.");
  return {param_place_order_request4_open_api_d_t_o:JSON.stringify({
    logistics_address:ship,
    product_items:[{product_count:1,product_id:Number(productId),sku_attr:variant,
      logistics_service_name:logistics}],
  })};
}
export function parseAliExpressUnpaidCreation(raw){
  const root=raw?.aliexpress_trade_buy_placeorder_response?.result;
  if(root?.is_success!==true)fail("AliExpress no confirmó la creación del pedido.");
  const ids=root.order_list?.number ?? root.order_list;
  const list=Array.isArray(ids)?ids:[ids];
  if(list.length!==1 || !ID.test(String(list[0]??"")))
    fail("AliExpress no devolvió un único ID externo comprobable.");
  return {externalOrderId:String(list[0]),provider:"aliexpress",
    status:"payment_required",paymentConfirmed:false,providerOrderCreated:true};
}
export function assertAliExpressFundedOrder(order,fulfillment){
  const amount=Number(order?.total);
  const md=order?.metadata||{};
  if(String(order?.status)!=="paid" || !(amount>0) ||
     md.freeCouponOrder===true || amount<Number(md.discount||0)*0 ||
     !String(order?.stripe_payment_intent_id||"").startsWith("pi_") ||
     String(order?.payment_method||"").toLowerCase()==="coupon")
      fail("No hay cobro Stripe positivo verificado; un cupón 100 % nunca autoriza compra al proveedor.");
  if(String(fulfillment?.orderId)!==String(order?.id) ||
     String(fulfillment?.externalOrderId||"").trim() ||
     ["ordered","shipped","delivered","payment_required","supplier_dispatch_unknown"].includes(String(fulfillment?.status)))
      fail("Pedido proveedor duplicado o requiere conciliación.");
  return true;
}
