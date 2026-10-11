/**
 * CJ warehouse inventory observations.
 * Read-only against CJ; writes only ephemeral observations to Neon app_storage,
 * NEVER merchant stock/prices, orders, Stripe or supplier balance.
 */
import crypto from "node:crypto";

export const CJ_STOCK_OBSERVER_PREFIX = "cjStockObservation:v1:";
const LEASE_KEY = "cjStockObserverLease:v1";
const CURSOR_KEY = "cjStockObserverCursor:v1";
export const CJ_STOCK_FRESH_MS = 45 * 60_000;
const validVid = value => /^[a-z0-9-]{8,100}$/i.test(String(value||""));

export function cjObservationKey(productId, vid) {
  return CJ_STOCK_OBSERVER_PREFIX + String(productId) + ":" + String(vid);
}
export function isCjStockProduct(product) {
  const meta = product?.metadata && typeof product.metadata==="object" ? product.metadata : {};
  let host = String(meta.sourceHost||"").toLowerCase().replace(/^www\./,"");
  if (!host) try { host = new URL(String(meta.sourceProductUrl||"")).hostname.toLowerCase().replace(/^www\./,""); } catch {}
  return (product?.status==="active" || product?.active===true) &&
    meta.fulfillmentType==="dropship" && host==="cjdropshipping.com";
}
export function cjObservedTargets(products) {
  const output = [];
  for (const p of Array.isArray(products)?products:[]) {
    if (!isCjStockProduct(p)) continue;
    const meta=p.metadata||{};
    const variants=Array.isArray(p.variants) && p.variants.length
      ? p.variants
      : [{supplierVariantId:meta.supplierVariantId||meta.cjVid, supplierSku:meta.supplierSku||meta.cjSku}];
    for (const variant of variants) {
      const vid=String(variant?.supplierVariantId||"").trim();
      if (!validVid(vid) || !String(variant?.supplierSku||"").trim()) continue;
      output.push({productId:String(p.id),vid,origin:"CN"});
    }
  }
  return [...new Map(output.map(v=>[cjObservationKey(v.productId,v.vid),v])).values()]
    .sort((a,b)=>cjObservationKey(a.productId,a.vid).localeCompare(cjObservationKey(b.productId,b.vid)));
}
export function readCjObservation(raw,{productId,vid,nowMs=Date.now(),maxAgeMs=CJ_STOCK_FRESH_MS}={}) {
  let item=null; try {item=typeof raw==="string"?JSON.parse(raw):raw;} catch {}
  const ageMs=nowMs-Date.parse(item?.checkedAt||"");
  const verified=Boolean(item?.verified===true && item?.source==="cj_api" &&
    item?.origin==="CN" && item?.vid===String(vid) && item?.productId===String(productId) &&
    Number.isSafeInteger(item?.quantity) && item.quantity>=0);
  const fresh=verified && Number.isFinite(ageMs) && ageMs>=0 && ageMs<=maxAgeMs;
  return {
    provider:"cj", origin:"CN", vid:String(vid||""),
    checkedAt:verified?item.checkedAt:null,
    verified, fresh, available:fresh && item.quantity>0,
    quantity:fresh?item.quantity:null, notReserved:true,
    checkoutRevalidates:true, source:fresh?"cj_api_observation":"unverified",
  };
}
export function createCjStockObserver({
  listProducts, read, upsert, mutate, queryStock, now=()=>Date.now(),
  maxPerSweep=4, logger=console,
}={}) {
  if (![listProducts,read,upsert,mutate,queryStock].every(fn=>typeof fn==="function"))
    throw new Error("CJ stock observer dependencies missing");
  let busy=false;
  const batchSize=Math.max(1,Math.min(4,Math.floor(maxPerSweep)));
  async function sweep() {
    if (busy) return {status:"already_running",inspected:0};
    busy=true;
    const owner=crypto.randomUUID(), current=now();
    let claimed=false;
    try {
      await mutate(LEASE_KEY,raw=>{
        let lease={}; try {lease=JSON.parse(raw||"{}");}catch{}
        if (Number(lease.expiresAt)>current) return String(raw||"{}");
        claimed=true;
        return JSON.stringify({owner,expiresAt:current+10*60_000});
      });
      if (!claimed) return {status:"another_worker",inspected:0};
      const targets=cjObservedTargets(await listProducts());
      if (!targets.length) return {status:"no_candidates",inspected:0};
      const previous=Number(await read(CURSOR_KEY));
      const start=Number.isSafeInteger(previous)&&previous>=0?previous%targets.length:0;
      let inspected=0, verified=0, limited=false, unavailable=0, invalid=0, outOfStock=0;
      for(let offset=0; offset<Math.min(batchSize,targets.length);offset++){
        const item=targets[(start+offset)%targets.length];
        try {
          const stock=await queryStock({vid:item.vid,origin:"CN"});
          if(stock?.verified===true && stock?.vid===item.vid && stock?.origin==="CN" &&
             Number.isSafeInteger(stock?.quantity) && stock.quantity>=0){
            await upsert(cjObservationKey(item.productId,item.vid),JSON.stringify({
              productId:item.productId,vid:item.vid,origin:"CN",quantity:stock.quantity,
              verified:true,source:"cj_api",checkedAt:new Date(now()).toISOString(),
            }));
            verified++;
            if(stock.quantity===0)outOfStock++;
          } else {
            invalid++;
          }
        }catch(e){
          // Never overwrite a previously verified observation with fake stock.
          if(["CJ_RATE_LIMITED","CJ_QUOTA_EXHAUSTED"].includes(String(e?.code||""))){
            limited=true; inspected++; break;
          }
          unavailable++;
          logger.warn?.("[cj.stock-observer] one supplier lookup unavailable",String(e?.code||"UPSTREAM").slice(0,40));
        }
        inspected++;
      }
      // Resume from the first uninspected candidate, including after quota stop.
      await upsert(CURSOR_KEY,String((start+inspected)%targets.length));
      return {status:limited?"rate_limited":"complete",inspected,verified,unavailable,invalid,outOfStock,rateLimited:limited,totalTargets:targets.length};
    }finally{
      if(claimed){
        try{await mutate(LEASE_KEY,raw=>{
          let old={};try{old=JSON.parse(raw||"{}")}catch{}
          return old.owner===owner?JSON.stringify({owner:"",expiresAt:0}):String(raw||"{}");
        });}catch(e){logger.warn?.("[cj.stock-observer] lease cleanup failed");}
      }
      busy=false;
    }
  }
  return {sweep};
}
