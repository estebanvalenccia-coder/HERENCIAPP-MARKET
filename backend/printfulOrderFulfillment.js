/**
 * Printful fulfillment draft connector. No payment/confirmation endpoint is called here.
 * A draft in Printful isn't a fulfillment order until explicitly confirmed (charge).
 */
const API="https://api.printful.com";
const fail=(message,statusCode=422)=>{const e=new Error(message);e.statusCode=statusCode;throw e;};
const id=v=>String(v??"").trim();
const numericId=v=>/^[1-9][0-9]{0,19}$/.test(id(v));
export function preparePrintfulDraft(order,products){
 const orderId=id(order?.id);if(!/^[a-z0-9-]{8,100}$/i.test(orderId))fail("Pedido Herencia inválido");
 if(!["paid","confirmed","preparing","processing"].includes(id(order?.status)))fail("El pedido no está confirmado para preparar Printful",409);
 const catalog=new Map((products||[]).map(p=>[id(p.id),p]));
 const rawItems=Array.isArray(order.items)?order.items:[];
 if(!rawItems.length)fail("Pedido sin artículos");
 const items=[];
 for(const row of rawItems){
  const product=catalog.get(id(row.id));
  if(!product || product?.metadata?.provider!=="printful")fail("El pedido contiene un producto ajeno a Printful; se necesita dividir el envío.",409);
  const selected=id(row.selectedVariant);
  const variant=(product.variants||[]).find(v=>id(v.name)===selected);
  if(!variant||!numericId(variant.printfulSyncVariantId)||!numericId(variant.printfulCatalogVariantId))
   fail("Falta la variante sincronizada original de Printful.",409);
  if(variant.printfulAvailability!=="active")fail("Variante Printful no verificada como activa.",409);
  if(row.printfulSyncVariantId&&id(row.printfulSyncVariantId)!==id(variant.printfulSyncVariantId))
   fail("La variante del carrito no coincide con Printful.",409);
  const quantity=Number(row.quantity);
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>20)fail("Cantidad de Printful inválida.",422);
  items.push({sync_variant_id:Number(variant.printfulSyncVariantId),quantity});
 }
 const address=order.metadata?.shippingAddress||{};
 const name=id(address.name||order.customer_name||order.customerName);
 const address1=id(address.address||address.line1||address.street);
 const city=id(address.city),zip=id(address.postalCode||address.zip||address.postcode);
 const country=id(address.country||"ES").toUpperCase();
 const email=id(order.customer_email||order.customerEmail);
 const phone=id(address.phone||order.metadata?.phone);
 if(!name||!address1||!city||!zip||!/^[A-Z]{2}$/.test(country)||!email.includes("@"))
   fail("Faltan datos de entrega para Printful: nombre, dirección, código postal, ciudad, país o email.",422);
 return {external_id:"HERENCIA-"+orderId,
  recipient:{name,address1,address2:id(address.address2||address.line2)||undefined,city,
    state_name:id(address.province||address.state)||undefined,country_code:country,zip,email,phone:phone||undefined},
  items};
}
export async function printfulOrderRequest(method,path,{payload,env=process.env,fetchImpl=fetch}={}){
 const token=id(env.PRINTFUL_API_TOKEN),storeId=id(env.PRINTFUL_STORE_ID);
 if(!token)fail("Falta PRINTFUL_API_TOKEN",503);
 if(storeId&&!numericId(storeId))fail("PRINTFUL_STORE_ID inválido",422);
 if(!/^\/orders(?:\/@HERENCIA-[a-z0-9-]+)?$/.test(path))fail("Ruta de pedidos Printful no autorizada",422);
 const request={method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json",...(storeId?{"X-PF-Store-Id":storeId}:{})},
  ...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(15000)};
 let response;
 try{response=await fetchImpl(API+path,request);}catch{fail("Resultado de Printful incierto: consultar por referencia externa antes de repetir.",503);}
 if(response.status===401||response.status===403)fail("Printful no permite gestionar pedidos con este token.",403);
 if(response.status===429)fail("Printful ha limitado solicitudes. Consultar antes de repetir.",429);
 if(response.status===404&&method==="GET")return null;
 if(!response.ok)fail("Printful no confirmó la operación. Conciliar antes de repetir.",response.status>=500?503:422);
 let data;try{data=await response.json();}catch{fail("Respuesta incompleta de Printful. Conciliar antes de repetir.",503);}
 if(!data?.result?.id)fail("Printful no devolvió ID verificable.",503);
 return {id:String(data.result.id),status:String(data.result.status||"unknown"),
   externalId:id(data.result.external_id),shipments:Array.isArray(data.result.shipments)?data.result.shipments.map(s=>({
    trackingNumber:id(s.tracking_number),trackingUrl:id(s.tracking_url),status:id(s.status)
   })):[]};
}
export const lookupPrintfulOrder=(orderId,opts={})=>printfulOrderRequest("GET","/orders/@HERENCIA-"+id(orderId),opts);
export const createPrintfulDraft=(payload,opts={})=>printfulOrderRequest("POST","/orders",{...opts,payload});

/**
 * Official Printful v1 estimate-costs is read-only. Costs are supplier amounts,
 * not customer retail amounts. Never infer a zero-cost order from missing fields.
 */
export function normalizePrintfulEstimate(payload){
 const costs=payload?.result?.costs||payload?.result;
 const currency=id(costs?.currency).toUpperCase();
 const total=Number(costs?.total);
 if(!/^[A-Z]{3}$/.test(currency)||!Number.isFinite(total)||total<0)
   fail("Printful no devolvió un coste completo con moneda verificable.",502);
 const lines=["subtotal","shipping","tax","vat","digitization","additional_fee","fulfillment_fee"];
 return {total,currency,breakdown:Object.fromEntries(lines.map(key=>[key,
   costs[key]==null?null:Number(costs[key])]).filter(([,value])=>value!=null&&Number.isFinite(value))),
   checkedAt:new Date().toISOString()};
}
/** Diagnostic metadata only: never logs Printful credentials or the recipient. */
export function summarizePrintfulRejection(body,httpStatus,payload={}){
 const error=body?.error&&typeof body.error==="object"?body.error:{};
 const original=String(error.message|| (typeof body?.result==="string"?body.result:"") || "").slice(0,550);
 const recipient=payload?.recipient||{};
 let safe=original;
 // Vendor error strings sometimes interpolate recipient fields; strip any matching
 // submitted customer details before the private admin/logging boundary.
 for(const part of [recipient.name,recipient.address1,recipient.address2,recipient.city,
    recipient.state_name,recipient.zip,recipient.email,recipient.phone]){
   const value=String(part||"").trim();
   if(value.length<3)continue;
   safe=safe.split(value).join("[REDACTED]");
 }
 safe=safe.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,"[EMAIL]")
   .replace(/(?:Bearer\s+|token[=:\s]+)[A-Za-z0-9._-]+/gi,"[SECRET]")
   .replace(/https?:\/\/\S+/gi,"[URL]")
   .replace(/(?:\+?\d[ -]?){7,}/g,"[NUMBER]")
   .replace(/[\r\n\t]/g," ").slice(0,240);
 const classifier=(String(error.reason||"")+" "+original).toLowerCase();
 const category=/external id|external_id|identifier/.test(classifier)?"identifier":
   /store|platform|integration|manual order|not connected/.test(classifier)?"store":
   /scope|auth|permission|access|token/.test(classifier)?"authorization":
   /file|design|mockup|print area|template/.test(classifier)?"print_file":
   /sync|variant|catalog|product/.test(classifier)?"variant":
   /zip|postal|address|recipient|shipping|country|state|delivery/.test(classifier)?"shipping":
   /currency|vat|tax|cost|payment/.test(classifier)?"pricing":"unknown";
 const providerReason=String(error.reason||"unknown").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,64);
 const providerCode=Number(body?.code);
 return {httpStatus:Number(httpStatus)||0,
   providerCode:Number.isInteger(providerCode)?providerCode:null,
   providerReason,category,detail:safe||"Printful no ofrece más información"};
}

export async function estimatePrintfulOrder(payload,{env=process.env,fetchImpl=fetch}={}){
 // Printful's estimate endpoint rejects an external_id because no provider
 // order is being created. Keep it only on POST /orders and its idempotent lookup.
 const {external_id:_unusedOrderReference,...estimatePayload}=payload||{};
 const token=id(env.PRINTFUL_API_TOKEN),storeId=id(env.PRINTFUL_STORE_ID);
 if(!token)fail("Falta PRINTFUL_API_TOKEN",503);
 if(storeId&&!numericId(storeId))fail("PRINTFUL_STORE_ID inválido",422);
 let response;
 try{response=await fetchImpl(API+"/orders/estimate-costs",{
   method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json",
     ...(storeId?{"X-PF-Store-Id":storeId}:{})},
   body:JSON.stringify(estimatePayload),signal:AbortSignal.timeout(15000)
 });}catch{fail("Printful no respondió a la cotización. No se ha autorizado ningún cargo.",503);}
 if(response.status===401||response.status===403)fail("Printful no permite cotizar pedidos con este token.",403);
 if(response.status===429)fail("Límite de consultas Printful; vuelve a intentarlo.",429);
 if(!response.ok){
   let data=null;try{data=await response.json();}catch{}
   const error=new Error("Printful rechazó la cotización del pedido.");
   error.statusCode=502;
   error.providerDiagnosis=summarizePrintfulRejection(data,response.status,payload);
   throw error;
 }
 let data;try{data=await response.json();}catch{fail("Printful devolvió una cotización ilegible.",502);}
 return normalizePrintfulEstimate(data);
}

/**
 * Real Printful financial action. ONLY the server-side guarded live mandate
 * may call this, never the browser or a Stripe payment webhook directly.
 * Timeout/5xx are uncertain outcomes: DO NOT automatically retry.
 */
export async function confirmPrintfulDraft(providerOrderId,{env=process.env,fetchImpl=fetch}={}){
 const token=id(env.PRINTFUL_API_TOKEN),storeId=id(env.PRINTFUL_STORE_ID),orderId=id(providerOrderId);
 if(!token)fail("Falta PRINTFUL_API_TOKEN",503);
 if(storeId&&!numericId(storeId))fail("PRINTFUL_STORE_ID inválido",422);
 if(!numericId(orderId))fail("ID Printful para confirmar inválido",422);
 const headers={Authorization:"Bearer "+token,"Content-Type":"application/json",
   ...(storeId?{"X-PF-Store-Id":storeId}:{})};
 let response;
 try{
   response=await fetchImpl(API+"/orders/"+orderId+"/confirm",{
     method:"POST",headers,signal:AbortSignal.timeout(15000),
   });
 }catch{fail("Confirmación Printful incierta: comprobar pedido, nunca repetir sin conciliación.",503);}
 if(response.status===401||response.status===403)fail("Printful no permite confirmar pedidos con este token.",403);
 if(!response.ok)fail("Printful no confirmó producción; conciliar antes de repetir.",response.status>=500?503:422);
 let result;
 try{result=(await response.json())?.result;}catch{fail("Respuesta de confirmación Printful incompleta; conciliar.",503);}
 if(String(result?.id)!==orderId)fail("Printful no devolvió el ID esperado al confirmar; conciliar.",503);
 return {id:orderId,status:id(result.status||"unknown"),externalId:id(result.external_id)};
}
