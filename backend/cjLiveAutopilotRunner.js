/**
 * Live CJ Autopilot orchestration. Backend callbacks are responsible for
 * validated one-time external create/pay actions and atomic budget ledgers.
 * No request handler, browser input or simulated preflight may authorize money.
 */
import crypto from "node:crypto";
import {validateCjLiveMandate,cjLiveMandatePermits} from "./cjLiveAutopilotMandate.js";
export const CJ_LIVE_RUNNER_LEASE="cjAutopilotLiveRunnerLease:v1";
const ACTIVE_STATES=new Set(["approval_required","autopilot_ready","payment_required"]);
export function eligibleCjLiveActions(ops={},mandate){
 const byId=new Map((ops.suppliers||[]).filter(x=>x?.integrationType==="cj").map(x=>[String(x.id),x]));
 return (ops.supplierFulfillments||[]).filter(record=>{
   const supplier=byId.get(String(record?.supplierId||""));
   return supplier && ACTIVE_STATES.has(String(record?.status||"")) &&
     cjLiveMandatePermits({mandate,record,supplier,
       amountEur:record.estimatedCost});
 }).filter(record=>{
   // Orders created manually continue requiring manual payment.
   if(record.status==="payment_required")
     return record.cjAutopilotMandateAt===mandate.createdAt &&
       Boolean(record.externalOrderId || record.cjShipmentOrderId);
   // A new mandate must NEVER retroactively buy historical queued orders.
   // Older orders remain supervised until the merchant approves them.
   const queuedAt=Date.parse(String(record.createdAt||""));
   const authorizedAt=Date.parse(String(mandate.createdAt||""));
   return Number.isFinite(queuedAt)&&Number.isFinite(authorizedAt) &&
     queuedAt>=authorizedAt &&
     !record.externalOrderId && !record.cjShipmentOrderId;
 }).sort((a,b)=>String(a.createdAt||"").localeCompare(String(b.createdAt||"")) ||
     String(a.id).localeCompare(String(b.id)));
}
export function createCjLiveAutopilotRunner({
 readOperations,readPolicy,readMandate,mutate,
 preflight,createUnpaid,payExisting,
 env=()=>({}),now=()=>Date.now(),logger=console,
}={}){
 if(![readOperations,readPolicy,readMandate,mutate,preflight,createUnpaid,payExisting,env]
   .every(x=>typeof x==="function"))throw new Error("CJ live runner needs complete dependencies");
 let busy=false;
 async function sweep(){
   if(busy)return {status:"busy",processed:0};
   busy=true;
   const owner=crypto.randomUUID(),started=now();let locked=false;
   try{
     const flags=env();
     if(flags.CJ_LIVE_AUTOPILOT_ENABLED!=="true" ||
        flags.CJ_LIVE_ORDER_CREATION_ENABLED!=="true" ||
        flags.CJ_LIVE_PAYMENT_ENABLED!=="true")
       return {status:"environment_disabled",processed:0};
     const [ops,policy,raw]=await Promise.all([readOperations(),readPolicy(),readMandate()]);
     const mandate=validateCjLiveMandate(raw,{policy,suppliers:ops.suppliers||[],nowMs:started});
     if(!mandate)return {status:"merchant_mandate_missing",processed:0};
     const selected=eligibleCjLiveActions(ops,mandate);
     if(!selected.length)return {status:"no_eligible_orders",processed:0};
     // Distributed lease: only one Railway replica may attempt an external
     // order/payment in this sweep. The ledger independently blocks repeats.
     await mutate(CJ_LIVE_RUNNER_LEASE,current=>{
       let lease={};try{lease=JSON.parse(current||"{}");}catch{}
       if(Number(lease.expiresAt)>started)return String(current||"{}");
       locked=true;
       return JSON.stringify({owner,expiresAt:started+10*60_000});
     });
     if(!locked)return {status:"another_worker",processed:0};
     // Refresh data AFTER the lease. Never operate on a stale queue.
     const latest=await readOperations();
     const stillValid=validateCjLiveMandate(await readMandate(),{
       policy:await readPolicy(),suppliers:latest.suppliers||[],nowMs:now(),
     });
     if(!stillValid||stillValid.createdAt!==mandate.createdAt)
       return {status:"mandate_revoked",processed:0};
     const live=eligibleCjLiveActions(latest,stillValid)[0];
     if(!live)return {status:"no_eligible_orders",processed:0};
     try{
       if(live.status==="payment_required"){
         await payExisting(live,stillValid);
         return {status:"paid",processed:1,fulfillmentId:String(live.id)};
       }
       const checks=await preflight(String(live.id));
       if(!checks || checks.readOnly!==true ||
          checks.eligibleForSupervisedTest!==true ||
          Array.isArray(checks.blockers)&&checks.blockers.length>0)
         return {status:"preflight_blocked",processed:0,fulfillmentId:String(live.id)};
       await createUnpaid(live,stillValid,checks);
       return {status:"created_unpaid",processed:1,fulfillmentId:String(live.id)};
     }catch(e){
       logger.warn?.("[cj.live-autopilot] one order requires attention",
         String(e?.code||"ACTION_BLOCKED").slice(0,40));
       return {status:"requires_attention",processed:0,fulfillmentId:String(live.id)};
     }
   }finally{
     if(locked){
       try{await mutate(CJ_LIVE_RUNNER_LEASE,current=>{
         let lease={};try{lease=JSON.parse(current||"{}");}catch{}
         return lease.owner===owner?JSON.stringify({owner:"",expiresAt:0}):String(current||"{}");
       });}catch{logger.warn?.("[cj.live-autopilot] lease cleanup failed");}
     }
     busy=false;
   }
 }
 return {sweep};
}
