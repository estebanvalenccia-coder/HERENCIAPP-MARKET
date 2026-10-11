/**
 * Scheduled, read-only CJ preflight: checks at most one local candidate per
 * sweep. The supplied check callback may query Stripe and CJ but must never
 * perform supplier creation, supplier payment or customer charges.
 */
import crypto from "node:crypto";
export const CJ_PREFLIGHT_CACHE_PREFIX="cjAutopilotPreflightCache:v1:";
export const CJ_PREFLIGHT_LEASE_KEY="cjAutopilotPreflightLease:v1";
export const CJ_PREFLIGHT_CURSOR_KEY="cjAutopilotPreflightCursor:v1";
const statuses=new Set(["approval_required","autopilot_ready"]);
export const cjPreflightKey=id=>CJ_PREFLIGHT_CACHE_PREFIX+String(id||"");
export function cjPreflightCandidates(records,allowedIds){
  const ids=new Set(Array.isArray(allowedIds)?allowedIds.map(String):[]);
  return (Array.isArray(records)?records:[])
    .filter(r=>r && /^[A-Za-z0-9_-]{1,120}$/.test(String(r.id||"")) &&
      statuses.has(String(r.status||"")) &&
      (r.provider==="cj" || ids.has(String(r.supplierId))) &&
      ids.has(String(r.supplierId)) &&
      !r.externalOrderId&&!r.cjShipmentOrderId)
    .sort((a,b)=>String(a.id).localeCompare(String(b.id)));
}
export function readCjPreflightCache(raw,{nowMs=Date.now()}={}){
  let payload;try{payload=typeof raw==="string"?JSON.parse(raw):raw;}catch{return null;}
  if(!payload||typeof payload!=="object"||!statuses.has(String(payload.sourceStatus||""))||
    !["eligible","blocked","unavailable"].includes(payload.status)||
    !Number.isFinite(Date.parse(payload.checkedAt||"")))return null;
  const age=nowMs-Date.parse(payload.checkedAt);
  return {checkedAt:payload.checkedAt,status:payload.status,sourceStatus:payload.sourceStatus,
    eligible:payload.status==="eligible",fresh:age>=0&&age<30*60_000,
    // Do not expose real-time supplier costs or Stripe details in the cache.
    message:payload.message||""};
}
export function createCjPreflightScheduler({load,read,write,mutate,check,now=()=>Date.now()}={}){
  if(![load,read,write,mutate,check].every(fn=>typeof fn==="function"))
    throw new Error("CJ preflight scheduler dependencies missing");
  let busy=false;
  async function sweep(){
    if(busy)return {status:"busy",checked:0};
    busy=true;const owner=crypto.randomUUID();let leased=false;
    try{
      const time=now();
      await mutate(CJ_PREFLIGHT_LEASE_KEY,raw=>{
        let state={};try{state=JSON.parse(raw||"{}")}catch{}
        if(Number(state.expiresAt)>time)return String(raw||"{}");
        leased=true;
        return JSON.stringify({owner,expiresAt:time+12*60_000});
      });
      if(!leased)return {status:"another_worker",checked:0};
      const state=await load();
      if(!state?.policy?.configured||state.policy.mode!=="simulation")
        return {status:"no_policy",checked:0};
      const candidates=cjPreflightCandidates(state.records,state.policy.allowedSupplierIds);
      if(!candidates.length)return {status:"no_candidates",checked:0};
      const cursor=Number(await read(CJ_PREFLIGHT_CURSOR_KEY));
      const start=Number.isSafeInteger(cursor)&&cursor>=0?cursor%candidates.length:0;
      for(let i=0;i<candidates.length;i++){
        const item=candidates[(start+i)%candidates.length];
        const previous=readCjPreflightCache(await read(cjPreflightKey(item.id)),{nowMs:time});
        if(previous?.fresh)continue;
        let status="unavailable",message="No se pudo verificar CJ y Stripe.";
        try{
          const result=await check(item.id);
          status=result?.eligibleForSupervisedTest===true?"eligible":"blocked";
          message=status==="eligible"?"Revisión en vivo superada; falta autorización para comprar.":
            "No supera todas las comprobaciones en vivo. Revisar los bloqueos del pedido.";
        }catch{
          // Do not cache provider error messages that might contain sensitive data.
          status="unavailable";
        }
        await write(cjPreflightKey(item.id),JSON.stringify({
          status,sourceStatus:String(item.status),checkedAt:new Date(now()).toISOString(),message,
        }));
        await write(CJ_PREFLIGHT_CURSOR_KEY,String((start+i+1)%candidates.length));
        return {status,checked:1,fulfillmentId:String(item.id)};
      }
      return {status:"recently_checked",checked:0};
    }finally{
      if(leased){
        try{await mutate(CJ_PREFLIGHT_LEASE_KEY,raw=>{
          let value={};try{value=JSON.parse(raw||"{}")}catch{}
          return value.owner===owner?JSON.stringify({owner:"",expiresAt:0}):String(raw||"{}");
        });}catch{}
      }
      busy=false;
    }
  }
  return {sweep};
}
