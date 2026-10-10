/**
 * CJ order-tracking automation. All supplier operations in this module are
 * strictly read-only, or local status projections. Never creates supplier
 * orders, spends balance, touches Stripe or clears ambiguous CJ reservations.
 */
import { verifiedCjQuoteMatches } from "./cjVariantIdentity.js";

export const CJ_TRACKABLE_LOCAL_STATUSES = Object.freeze(["ordered", "shipped"]);
const CJ_REMOTE_STAGES = Object.freeze({
  PAID: "ordered", UNSHIPPED: "ordered", PROCESSING: "ordered", COMPLETED: "ordered",
  SHIPPED: "shipped", DELIVERED: "delivered",
});
const STAGE_RANK=Object.freeze({ordered:1,shipped:2,delivered:3});
const REQUIRE_MANUAL=new Set([
  "cj_creating","cj_creation_unknown","cj_paying","cj_payment_unknown",
  "payment_required","approval_required","action_required","disputed",
  "cancelled","canceled","refunded","returned","closed",
]);

const value=(item,max=180)=>String(item??"").trim().slice(0,max);
const toCountry=input=>{
  const c=value(input,32).toLowerCase();
  return ["es","spain","españa"].includes(c)?"ES":c.toUpperCase();
};
function safeTrackingUrl(input){
  try{
    if(!input)return "";
    const url=new URL(String(input));
    if(url.protocol!=="https:" || url.username || url.password || !url.hostname.includes("."))return "";
    return url.toString().slice(0,800);
  }catch{return "";}
}
export function isCjTrackingCandidate(record,supplier,{nowMs=Date.now(),minAgeMs=10*60*1000}={}){
  if(!record || !supplier || supplier.active===false ||
    String(supplier.integrationType)!=="cj" && record.provider!=="cj")return false;
  const status=value(record.status).toLowerCase();
  if(!CJ_TRACKABLE_LOCAL_STATUSES.includes(status)||REQUIRE_MANUAL.has(status) ||
     !value(record.externalOrderId,150))return false;
  const last=Date.parse(value(record.providerSyncedAt));
  return !Number.isFinite(last)||last>nowMs||nowMs-last>=minAgeMs;
}
export function pickCjTrackingCandidates(records=[],suppliers=[],{
  nowMs=Date.now(),limit=3,minAgeMs=10*60*1000
}={}){
  const supplierMap=new Map((Array.isArray(suppliers)?suppliers:[]).map(s=>[String(s.id),s]));
  const size=Math.max(0,Math.min(3,Math.floor(Number(limit)||0)));
  return (Array.isArray(records)?records:[]).filter(record=>
    isCjTrackingCandidate(record,supplierMap.get(String(record.supplierId)),{nowMs,minAgeMs}))
    .sort((a,b)=>(Date.parse(a.providerSyncedAt)||0)-(Date.parse(b.providerSyncedAt)||0))
    .slice(0,size);
}
export function projectCjTracking(record,remote,{now=new Date().toISOString()}={}){
  if(!record?.externalOrderId||!CJ_TRACKABLE_LOCAL_STATUSES.includes(value(record.status)))return {
    accepted:false,reason:"protected_status",patch:null
  };
  if(!remote || String(remote.orderId??"").trim()!==String(record.externalOrderId).trim())return {
    accepted:false,reason:"order_id_mismatch",patch:null
  };
  const providerStatus=value(remote.orderStatus,45).toUpperCase();
  const target=CJ_REMOTE_STAGES[providerStatus];
  if(!target)return {accepted:false,reason:"remote_status_requires_review",patch:null};
  if(STAGE_RANK[target]<STAGE_RANK[value(record.status)])return {
    accepted:false,reason:"status_regression",patch:null
  };
  const remoteTracking=value(remote.trackNumber,160);
  const incomingUrl=safeTrackingUrl(remote.trackingUrl);
  const previousTracking=value(record.trackingNumber,160);
  // A replacement tracking number might correspond to a different parcel.
  // Keep the existing reference and request explicit review.
  if(previousTracking && remoteTracking && previousTracking!==remoteTracking)return {
    accepted:false,reason:"tracking_number_changed",patch:null
  };
  const patch={
    status:target,providerOrderStatus:providerStatus,providerSyncedAt:now,updatedAt:now,
    trackingNumber:remoteTracking||previousTracking,
    trackingUrl:incomingUrl||safeTrackingUrl(record.trackingUrl),
  };
  return {accepted:true,reason:"verified_read_only",patch,
    meaningfulChange:target!==record.status ||
      Boolean(remoteTracking&&!previousTracking) ||
      Boolean(incomingUrl&&!record.trackingUrl)};
}

export function explainCjAutomationReadiness({
  record={},supplier={},order=null,env={},nowMs=Date.now()
}={}){
  const reasons=[];
  if(!env.CJ_API_KEY)reasons.push("La conexión CJ no está configurada en el servidor.");
  if(supplier.integrationType!=="cj"||supplier.active===false)reasons.push("Proveedor CJ inactivo o incorrecto.");
  if(supplier.cjSandbox!==false)reasons.push("Proveedor en modo simulación; solo se admite consulta.");
  if(!record.id||!record.orderId||record.supplierId!==supplier.id)reasons.push("La cola CJ no está vinculada al pedido.");
  if(!order || order.id!==record.orderId || !["paid","confirmed","preparing","processing","ready"].includes(order.status))
    reasons.push("El pedido debe estar confirmado por Herencia y verificado de forma independiente con Stripe.");
  if(REQUIRE_MANUAL.has(value(record.status)))reasons.push("Operación bloqueada o pendiente de revisión/conciliación.");
  const lines=Array.isArray(record.items)?record.items:[];
  if(lines.length!==1||Number(lines[0]?.quantity)!==1)reasons.push("La cotización CJ actual solo admite una unidad y variante.");
  const line=lines[0]||{};
  const zip=value(record.shippingAddress?.postalCode,20);
  if(toCountry(record.shippingAddress?.country)!=="ES"||!/^[0-9]{5}$/.test(zip))
    reasons.push("El checkout CJ actual solo está validado para código postal de España.");
  if(!verifiedCjQuoteMatches({
    quote:line.cjPricingEstimate,
    identity:{vid:value(line.supplierVariantId),sku:value(line.supplierSku),
      name:value(line.selectedVariant)},
    destination:"ES",postalCode:zip,methodName:value(line.cjPreferredLogisticName),
    salePriceEur:Number(line.salePrice),nowMs
  }))reasons.push("El precio, SKU/VID o transporte no tiene cotización CJ reciente y exacta.");
  if(!(Number(supplier.maxAutoOrderTotal)>0) || !(Number(supplier.cjMaxPaymentUsd)>0))
    reasons.push("No hay límites comerciales positivos y verificables para proveedor/pedido.");
  if(!env.CJ_LIVE_ORDER_CREATION_ENABLED||String(env.CJ_LIVE_ORDER_CREATION_ENABLED).toLowerCase()!=="true")
    reasons.push("La creación de pedidos reales sigue desactivada en Railway.");
  if(String(env.CJ_LIVE_PAYMENT_ENABLED).toLowerCase()!=="true")
    reasons.push("Los pagos reales al proveedor siguen desactivados en Railway.");
  // These two additional approvals have no defaults. Even true environment
  // flags cannot substitute for demonstrated Stripe funds or merchant consent.
  reasons.push("Falta verificar pago Stripe, presupuesto diario y autorizar gastos automáticos.");
  return {
    supplier:"cj",integrationConfigured:Boolean(env.CJ_API_KEY),autoPurchaseEnabled:false,
    autoPaymentEnabled:false,trackingReadOnly:true,manualApprovalRequired:true,
    blockers:reasons,readyForUnattendedBuying:false
  };
}
