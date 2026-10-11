/**
 * Read-only recovery for ambiguous CJ supplier actions.
 *
 * Only queries an EXISTING external order ID, never calls createOrderV2,
 * payBalance, Stripe or any provider mutation. A status is promoted solely
 * after provider identity, bounded amount and state are positively verified.
 */
import crypto from "node:crypto";
export const CJ_RECON_LEASE_KEY="cjAutopilotReconciliationLease:v1";
const candidates=new Set(["cj_creation_unknown","cj_payment_unknown","payment_required"]);
const paidStatus=new Map([
  ["PAID","ordered"],["UNSHIPPED","ordered"],["PROCESSING","ordered"],
  ["COMPLETED","ordered"],["SHIPPED","shipped"],["DELIVERED","delivered"],
]);
const unpaidStatus=new Set(["CREATED","UNPAID","IN_CART"]);
const safeCurrencyAmount=value=>typeof value!=="boolean"&&value!==null&&
  value!==undefined&&value!==""&&Number.isFinite(Number(value))?Number(value):NaN;

export function pickCjReconciliationCandidates(records=[],suppliers=[],{limit=1}={}){
  const cj=new Map((Array.isArray(suppliers)?suppliers:[])
    .filter(s=>s?.integrationType==="cj")
    .map(s=>[String(s.id),s]));
  const count=Math.max(0,Math.min(1,Math.floor(Number(limit)||0)));
  return (Array.isArray(records)?records:[]).filter(r=>
    r && candidates.has(String(r.status||"")) &&
    (r.provider==="cj" || cj.has(String(r.supplierId))) &&
    cj.has(String(r.supplierId)) &&
    /^[A-Za-z0-9-]{6,120}$/.test(String(r.id||"")) &&
    /^[A-Za-z0-9_-]{4,130}$/.test(String(r.externalOrderId||""))
  ).sort((a,b)=>String(a.cjReconCheckedAt||"").localeCompare(String(b.cjReconCheckedAt||"")) ||
    String(a.id).localeCompare(String(b.id))).slice(0,count);
}

export function projectCjAmbiguousReconciliation(record,supplier,remote){
  const reject=(reason)=>({verified:false,reason,patch:null,retryAllowed:false});
  if(!record?.id || !supplier || String(record.supplierId)!==String(supplier.id) ||
    supplier.integrationType!=="cj" ||
    !candidates.has(String(record.status||"")))
    return reject("invalid_local_order");
  if(!record.externalOrderId || !remote ||
     String(remote.orderId||"")!==String(record.externalOrderId))
    return reject("external_order_identity_mismatch");
  const status=String(remote.orderStatus||"").toUpperCase();
  const paid=paidStatus.get(status);
  const unpaid=unpaidStatus.has(status);
  if(!paid && !unpaid)return reject("unrecognized_remote_status");
  const amount=safeCurrencyAmount(remote.actualPayment??remote.orderAmount);
  const approvedUsd=safeCurrencyAmount(record.cjManualAuthorization?.approvedMaxUsd);
  const supplierUsd=safeCurrencyAmount(supplier.cjMaxPaymentUsd);
  if(!(amount>0&&approvedUsd>0&&supplierUsd>0&&amount<=approvedUsd&&amount<=supplierUsd))
    return reject("amount_not_confirmed_or_exceeds_cap");
  if(record.status==="cj_payment_unknown" && !paid)
    return reject("payment_ambiguous_must_remain_locked");
  const next=paid||"payment_required";
  if(record.status===next)return {verified:true,reason:"already_reconciled",patch:null,retryAllowed:false};
  return {verified:true,reason:paid?"confirmed_paid":"confirmed_unpaid",
    retryAllowed:false,patch:{
      status:next,
      provider:"cj",
      providerActualPayment:Math.round(amount*100)/100,
      providerOrderStatus:status,
      providerCurrency:"USD",
      providerSyncedAt:new Date().toISOString(),
      cjShipmentOrderId:String(remote.shipmentOrderId||record.cjShipmentOrderId||""),
      blocker:paid?"":"Pedido existente confirmado como impagado; requiere autorización independiente de pago.",
    }};
}

export function createCjAmbiguousReconciler({
  load,fetchRemote,apply,mutate,now=()=>Date.now(),logger=console,
}={}){
  if(![load,fetchRemote,apply,mutate].every(x=>typeof x==="function"))
    throw new Error("CJ reconciliation dependencies unavailable");
  let busy=false;
  async function sweep(){
    if(busy)return {status:"busy",checked:0,changed:0};
    busy=true;
    const owner=crypto.randomUUID(),time=now();let claimed=false;
    try{
      await mutate(CJ_RECON_LEASE_KEY,raw=>{
        let lock={};try{lock=JSON.parse(raw||"{}");}catch{}
        if(Number(lock.expiresAt)>time)return String(raw||"{}");
        claimed=true;
        return JSON.stringify({owner,expiresAt:time+10*60_000});
      });
      if(!claimed)return {status:"another_worker",checked:0,changed:0};
      const operations=await load();
      const items=pickCjReconciliationCandidates(
        operations?.supplierFulfillments,operations?.suppliers,{limit:1});
      if(!items.length)return {status:"no_candidates",checked:0,changed:0};
      const record=items[0];
      const supplier=(operations?.suppliers||[]).find(s=>String(s.id)===String(record.supplierId));
      let remote;
      try{remote=await fetchRemote(String(record.externalOrderId));}
      catch(e){
        logger.warn?.("[cj.reconcile] existing order read unavailable",String(e?.code||"PROVIDER").slice(0,40));
        return {status:"provider_unavailable",checked:1,changed:0};
      }
      const decision=projectCjAmbiguousReconciliation(record,supplier,remote);
      if(!decision.patch)return {status:decision.reason,checked:1,changed:0};
      // Apply must perform CAS on status, identity and previous authorization.
      await apply(record,decision.patch);
      return {status:decision.reason,checked:1,changed:1};
    }finally{
      if(claimed){
        try{await mutate(CJ_RECON_LEASE_KEY,raw=>{
          let lock={};try{lock=JSON.parse(raw||"{}");}catch{}
          return lock.owner===owner?JSON.stringify({owner:"",expiresAt:0}):String(raw||"{}");
        });}catch{logger.warn?.("[cj.reconcile] lease cleanup failed");}
      }
      busy=false;
    }
  }
  return {sweep};
}
