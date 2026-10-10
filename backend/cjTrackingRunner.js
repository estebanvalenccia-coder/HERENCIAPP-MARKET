/**
 * Background/manual CJ shipping reconciliation. Only GETs an existing CJ
 * order, validates its identity and projects tracking/status into Neon.
 * No supplier order creation, payment, customer charges, refunds or retries.
 */
import {isCjTrackingCandidate,pickCjTrackingCandidates,projectCjTracking} from "./cjTrackingAutomation.js";

const error=(message,statusCode=409)=>{
  const e=new Error(message);e.statusCode=statusCode;return e;
};
export function createCjTrackingRunner({
  readOperations,readRemote,mutateOperations,claimLease,
  readOrder,patchOrder,notify,
  now=()=>Date.now(),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
}={}){
  async function syncOne(snapshot){
    if(!snapshot?.externalOrderId)throw error("Falta referencia CJ.");
    const operations=await readOperations();
    const supplier=(operations.suppliers||[]).find(s=>String(s.id)===String(snapshot.supplierId));
    if(!isCjTrackingCandidate(snapshot,supplier,{nowMs:now(),minAgeMs:0})){
      throw error("El estado CJ requiere revisión manual o no admite sincronización.");
    }
    const remote=await readRemote(snapshot.externalOrderId);
    const projection=projectCjTracking(snapshot,remote,{now:new Date(now()).toISOString()});
    if(!projection.accepted)throw error(
      "CJ requiere revisión: "+projection.reason+". No se ha modificado el pedido.");
    let saved;
    await mutateOperations(raw=>{
      let data;
      try{data=JSON.parse(raw||"{}");}catch{throw error("Cola de proveedor ilegible.");}
      const items=Array.isArray(data.supplierFulfillments)?data.supplierFulfillments:[];
      const index=items.findIndex(x=>String(x.id)===String(snapshot.id));
      const original=items[index];
      const activeSupplier=(data.suppliers||[]).find(x=>String(x.id)===String(original?.supplierId));
      if(!original ||
        !isCjTrackingCandidate(original,activeSupplier,{nowMs:now(),minAgeMs:0}) ||
        String(original.updatedAt)!==String(snapshot.updatedAt) ||
        String(original.externalOrderId)!==String(snapshot.externalOrderId) ||
        String(original.status)!==String(snapshot.status)){
        throw error("El pedido CJ ha cambiado durante la consulta. No sobrescribas datos.");
      }
      saved={...original,...projection.patch};
      const changed=[...items];changed[index]=saved;
      return JSON.stringify({...data,supplierFulfillments:changed});
    });
    if(projection.meaningfulChange && saved?.orderId &&
       ["shipped","delivered"].includes(saved.status)){
      try{
        const order=await readOrder(saved.orderId);
        if(order){
          await patchOrder(saved.orderId,{metadata:{
            ...(order.metadata||{}),
            supplierTracking:{
              ...(order.metadata?.supplierTracking||{}),
              [saved.id]:{
                supplier:saved.supplierName,externalOrderId:saved.externalOrderId,
                trackingNumber:saved.trackingNumber,trackingUrl:saved.trackingUrl,
                status:saved.status,updatedAt:saved.updatedAt
              }
            }
          }});
        }
      }catch{
        // A failed customer metadata write must not alter or redo CJ's shipment.
      }
      if(typeof notify==="function"){
        await notify({
          type:"supplier_tracking_update",
          title:"Actualización del envío CJ",
          message:"Pedido #"+String(saved.orderId).slice(0,8)+
            ": "+(saved.status==="delivered"?"entregado":"enviado"),
          entityType:"order",entityId:String(saved.orderId),
          dedupeKey:"cj-tracking:"+saved.id+":"+saved.status+":"+(saved.trackingNumber||""),
        }).catch(()=>null);
      }
    }
    return {fulfillment:saved,meaningfulChange:projection.meaningfulChange,readOnly:true};
  }

  async function sweep(){
    const ops=await readOperations();
    const selected=pickCjTrackingCandidates(ops.supplierFulfillments,ops.suppliers,{
      nowMs:now(),limit:3,minAgeMs:10*60*1000,
    });
    let checked=0,changed=0;const errors=[];
    for(let i=0;i<selected.length;i++){
      const candidate=selected[i],stamp=new Date(now()).toISOString();
      const leaseKey="cjTrackingReadOnlyLease:"+String(candidate.id)
        .replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
      let acquired=false;
      try{
        await claimLease(leaseKey,raw=>{
          let previous={};try{previous=JSON.parse(raw||"{}");}catch{}
          const earlier=Date.parse(String(previous.claimedAt||""));
          if(Number.isFinite(earlier)&&now()-earlier<14*60*1000)
            throw error("Seguimiento CJ ya consultado recientemente.");
          acquired=true;
          return JSON.stringify({claimedAt:stamp,fulfillmentId:String(candidate.id)});
        });
      }catch(e){if(e.statusCode!==409)errors.push("lease_unavailable");continue;}
      if(!acquired)continue;
      try{
        const result=await syncOne(candidate);
        checked++;
        if(result.meaningfulChange)changed++;
      }catch(e){
        errors.push(e.statusCode===409?"manual_review":"provider_unavailable");
      }
      if(i+1<selected.length)await delay(1400);
    }
    return {checked,changed,errors,readOnly:true,
      automaticSupplierOrders:false,automaticSupplierPayments:false};
  }
  return {syncOne,sweep};
}
