/**
 * Live, UNPAID AliExpress order runner.
 * Fail closed on unsupported payment, unverified variant, shipping, margin,
 * authorization, or prior ambiguous network attempts. Never charges suppliers.
 */
import { assertAliExpressFundedOrder } from "./aliexpressLiveOrderProtocol.js";
import { parseUniversalSupplierBudget } from "./unifiedSupplierBudget.js";
import { universalDay,reserveUniversalBudgetAtomic,settleUniversalBudgetAtomic } from "./universalSupplierLedger.js";
const ID=/^[a-z0-9-]{8,100}$/i;
const ATTEMPT="aliexpressUnpaidOrderAttempt:v1:";
const fail=(message)=>{const err=new Error(message);err.statusCode=409;throw err;};
const money=n=>Math.round(Number(n)*100)/100;
export const aliExpressAttemptKey=id=>{
 if(!ID.test(String(id)))fail("Fulfillment ID incorrecto.");
 return ATTEMPT+id;
};
const isAliExpress=row=>String(row?.sourceHost||"").replace(/^www\./,"")==="aliexpress.com" ||
  String(row?.supplierName||"").toLowerCase()==="aliexpress";
export function pickAliExpressUnpaidCandidates(ops){
 const suppliers=Array.isArray(ops?.suppliers)?ops.suppliers:[];
 return (Array.isArray(ops?.supplierFulfillments)?ops.supplierFulfillments:[])
  .filter(row=>row && row.mode==="autopilot" && isAliExpress(row) &&
    !row.queueRemoved && !row.externalOrderId &&
    ["connector_required","autopilot_ready","cost_required","mapping_required"].includes(String(row.status)) &&
    suppliers.some(s=>String(s.id)===String(row.supplierId) && s.active!==false))
  .slice(0,10);
}
export function evaluateAliExpressCost({order,unitEur,freightEur,policy}){
 const sale=Number(order?.total),unit=Number(unitEur),shipping=Number(freightEur);
 if(![sale,unit,shipping].every(Number.isFinite)||sale<=0||unit<=0||shipping<0)
    fail("No hay pago y coste real verificados en EUR.");
 const conservativeImportTax=money((unit+shipping)*0.21);
 const stripeFee=money(sale*0.015+0.25);
 const vendorTotal=money(unit+shipping+conservativeImportTax);
 const merchantNet=money(sale/1.21);
 const netProfit=money(merchantNet-vendorTotal-stripeFee);
 const margin=merchantNet>0 ? netProfit/merchantNet*100 : -Infinity;
 if(!Number.isFinite(margin)||margin<Number(policy.minMarginPercent) ||
    vendorTotal>Number(policy.perOrderMaxEur) || vendorTotal>Number(policy.dailyMaxEur))
    fail("Presupuesto, IVA o margen insuficiente para el pedido AliExpress.");
 return {vendorTotalEur:vendorTotal,estimatedNetProfitEur:netProfit,estimatedMarginPct:money(margin),
    importTaxReserveEur:conservativeImportTax,stripeFeeEur:stripeFee};
}
export function createAliExpressUnpaidRunner(deps){
 const {read,mutate,loadOrder,loadProduct,verifyStripePayment,loadProviderProduct,
  quoteFreight,placeUnpaidOrder,now=()=>new Date()}=deps;
 if([read,mutate,loadOrder,loadProduct,verifyStripePayment,loadProviderProduct,quoteFreight,placeUnpaidOrder].some(fn=>typeof fn!=="function"))
    throw new Error("AliExpress runner missing dependency");
 async function processOne(row){
   if(process.env.ALIEXPRESS_LIVE_ORDER_CREATION_ENABLED!=="true" ||
      process.env.ALIEXPRESS_UNPAID_ORDER_AUTO_ENABLED!=="true" ||
      process.env.ALIEXPRESS_CUSTOMER_ADDRESS_TRANSFER_APPROVED!=="true" ||
      process.env.ALIEXPRESS_PROVIDER_ORDER_API_VERIFIED!=="true")return {status:"not_authorized"};
   if(!isAliExpress(row)||row.mode!=="autopilot")return {status:"not_eligible"};
   const ops=JSON.parse(await read("posOperations")||"{}");
   const current=(ops.supplierFulfillments||[]).find(x=>x.id===row.id);
   if(!current||current.externalOrderId||!pickAliExpressUnpaidCandidates(ops).some(x=>x.id===row.id))
     return {status:"not_eligible"};
   const order=await loadOrder(current.orderId);
   assertAliExpressFundedOrder(order,current);
   const invoice=await verifyStripePayment(order);
   if(invoice?.verified!==true)fail("Stripe no confirmó financiación LIVE de este pedido.");
   const lines=Array.isArray(current.items)?current.items:[];
   if(lines.length!==1||Number(lines[0].quantity)!==1)fail("Se admite una única variante por pedido AliExpress.");
   const line=lines[0];
   const product=await loadProduct(line.productId);
   const metadata=product?.metadata||{};
   if(!product||product.status!=="active"||metadata.sourceProvider!=="aliexpress" ||
       metadata.orderAutomationEnabled!==true || metadata.costAndShippingVerified!==true)
       fail("Producto AliExpress sin aprobación de automatización, costes y cumplimiento.");
   if(metadata.complianceVerified!==true||metadata.approvedForPublication!==true)
       fail("Falta validación legal de la ficha del proveedor.");
   const selected=Array.isArray(product.variants)?product.variants.filter(x=>String(x.name)===String(line.selectedVariant)):[];
   if(selected.length!==1)fail("Variante del comprador ambigua.");
   const sku=String(selected[0].supplierSku||selected[0].sku||"");
   const sourceId=String(metadata.sourceProductId||metadata.providerOrderProductId||"");
   const provider=await loadProviderProduct(sourceId);
   const matched=provider?.variants?.filter(x=>String(x.sku)===sku||String(x.variantId)===String(selected[0].supplierVariantId));
   if(matched?.length!==1||matched[0].stockKnown!==true||matched[0].stock<1||
     matched[0].available!==true||matched[0].currency!=="EUR"||!(matched[0].price>0))
       fail("AliExpress no verificó la variante, precio o stock para España.");
   const address=order.metadata?.shippingAddress||{};
   if(address.country!=="ES"||!address.postalCode||!address.address||!address.name||!address.phone)
      fail("Falta dirección de cliente completa para AliExpress.");
   const methods=await quoteFreight({productId:sourceId,skuId:sku,quantity:1,country:"ES"});
   if(!methods.length)fail("Sin envío AliExpress cotizado en EUR para España.");
   const best=[...methods].sort((a,b)=>a.shippingCostEur-b.shippingCostEur)[0];
   const policy=parseUniversalSupplierBudget(await read("unifiedSupplierBudget:v1"));
   if(policy.providers.aliexpress!==true||!Number.isFinite(policy.perOrderMaxEur)||!Number.isFinite(policy.minMarginPercent))
      fail("No se ha configurado presupuesto y margen para AliExpress.");
   const costs=evaluateAliExpressCost({order,unitEur:matched[0].price,freightEur:best.shippingCostEur,policy});
   const day=universalDay(now());
   await reserveUniversalBudgetAtomic(mutate,{
     day,orderId:String(order.id),provider:"aliexpress",amountEur:costs.vendorTotalEur,policy,
     paidOrderVerified:true,providerQuoteVerified:true,marginVerified:true,
   });
   let reserved=true,remoteAttempted=false;
   try{
     await mutate(aliExpressAttemptKey(current.id),raw=>{
       if(raw)fail("El pedido AliExpress ya tiene un intento, conciliar antes de repetir.");
       return JSON.stringify({state:"creating",orderId:order.id,startedAt:now().toISOString()});
     });
     remoteAttempted=true;
     const created=await placeUnpaidOrder({
       productId:sourceId,skuAttr:sku,logisticsServiceName:best.service,quantity:1,
       address:{country:"ES",street:address.address,street2:address.address2,
         city:address.city,province:address.province,postalCode:address.postalCode,
         recipient:address.name,phone:address.phone},
     });
     await mutate(aliExpressAttemptKey(current.id),()=>JSON.stringify({
       state:"payment_required",externalOrderId:created.externalOrderId,orderId:order.id,checkedAt:now().toISOString(),
     }));
     await mutate("posOperations",raw=>{
       const state=JSON.parse(raw||"{}");
       const idx=(state.supplierFulfillments||[]).findIndex(x=>x.id===current.id);
       if(idx<0)fail("La cola de proveedores cambió; el pedido externo está en el registro de intentos.");
       const old=state.supplierFulfillments[idx];
       if(old.externalOrderId && old.externalOrderId!==created.externalOrderId)fail("Orden externa inesperada, conciliación requerida.");
       state.supplierFulfillments[idx]={...old,externalOrderId:created.externalOrderId,status:"payment_required",
         blocker:"AliExpress creó el pedido SIN PAGAR. Debes confirmar su pago al proveedor.",
         estimatedCost:costs.vendorTotalEur,updatedAt:now().toISOString()};
       return JSON.stringify(state);
     });
     return {status:"payment_required",externalOrderId:created.externalOrderId};
   }catch(err){
     if(remoteAttempted){
       await mutate(aliExpressAttemptKey(current.id),raw=>{
         const old=JSON.parse(raw||"{}");
         if(old.externalOrderId)return raw;
         return JSON.stringify({state:"unknown",orderId:order.id,reason:"reconcile_required",since:now().toISOString()});
       }).catch(()=>{});
       await settleUniversalBudgetAtomic(mutate,{day,orderId:String(order.id),status:"uncertain",remoteAttempted:true}).catch(()=>{});
     }else if(reserved){
       await settleUniversalBudgetAtomic(mutate,{day,orderId:String(order.id),status:"released",remoteAttempted:false}).catch(()=>{});
     }
     throw err;
   }
 }
 async function sweep(){
   if(process.env.ALIEXPRESS_UNPAID_ORDER_AUTO_ENABLED!=="true")return {status:"disabled",processed:0};
   const ops=JSON.parse(await read("posOperations")||"{}");
   const candidates=pickAliExpressUnpaidCandidates(ops);
   for(const row of candidates){
     try{return {status:"checked",recordId:row.id,result:await processOne(row)};}
     catch(err){return {status:"blocked",recordId:row.id,reason:String(err.message).slice(0,150)};}
   }
   return {status:"no_candidates",processed:0};
 }
 return {processOne,sweep};
}
