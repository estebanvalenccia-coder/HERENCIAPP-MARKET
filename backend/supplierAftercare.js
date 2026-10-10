/**
 * Internal supplier aftercare cases; never issues refunds, cancellation calls,
 * provider requests, tracking changes or payment operations.
 */
import crypto from "node:crypto";
const REASONS=new Set(["delivery_delay","wrong_variant","damaged","lost","return_request","refund_request","supplier_error"]);
const NEXT=Object.freeze({
  open:["in_review","awaiting_supplier","closed"],
  in_review:["awaiting_supplier","resolved","closed"],
  awaiting_supplier:["in_review","resolved","closed"],
  resolved:["closed","in_review"],
  closed:[],
});
const fail=(message,statusCode=422)=>{const e=new Error(message);e.statusCode=statusCode;throw e;};
const text=(value,max=450)=>String(value||"").trim().replace(/[\u0000-\u001f]/g," ").slice(0,max);
export function readSupplierAftercare(raw) {
  try {
    const items=JSON.parse(raw||"[]");
    return Array.isArray(items)?items.slice(0,500).filter(x=>x&&typeof x==="object"):[];
  } catch{return [];}
}
export function createAftercareCase(raw,{orderId,supplierId,reason,note=""}={},now=new Date().toISOString()){
  const id=text(orderId,110),supplier=text(supplierId,100);
  if(!/^[a-zA-Z0-9_-]{1,110}$/.test(id)||! /^[a-zA-Z0-9_-]{1,100}$/.test(supplier) ||
    !REASONS.has(reason))fail("Pedido, proveedor o motivo de incidencia no válido.");
  const cases=readSupplierAftercare(raw);
  const caseId="scase_"+crypto.createHash("sha256").update(id+"\u0000"+supplier+"\u0000"+reason).digest("hex").slice(0,32);
  const existing=cases.find(c=>c.id===caseId);
  if(existing)return {serialized:JSON.stringify(cases),case:existing,created:false};
  if(cases.length>=500)fail("Se ha alcanzado el límite de incidencias.");
  const item={
    id:caseId,orderId:id,supplierId:supplier,reason,status:"open",revision:1,
    note:text(note),createdAt:now,updatedAt:now,
    events:[{type:"created",status:"open",at:now}],
    automatedRefund:false,automatedPurchases:false,
  };
  cases.unshift(item);
  return {serialized:JSON.stringify(cases),case:item,created:true};
}
export function transitionAftercareCase(raw,{caseId,expectedRevision,toStatus,note=""}={},now=new Date().toISOString()){
  if(!/^scase_[a-f0-9]{32}$/.test(String(caseId||"")))fail("Identificador de incidencia no válido.");
  const cases=readSupplierAftercare(raw);
  const item=cases.find(c=>c.id===caseId);
  if(!item)fail("Incidencia no encontrada.",404);
  if(!Number.isInteger(expectedRevision)||expectedRevision!==item.revision)fail("La incidencia se ha actualizado. Vuelve a cargarla.",409);
  if(!NEXT[item.status]?.includes(toStatus))fail("Cambio de estado no permitido.");
  const updated={
    ...item,status:toStatus,revision:item.revision+1,
    note:text(note)||item.note,updatedAt:now,
    events:[...item.events.slice(-29),{type:"status_updated",status:toStatus,at:now}]
  };
  const next=cases.map(c=>c.id===caseId?updated:c);
  return {serialized:JSON.stringify(next),case:updated,changed:true};
}
export function supplierAftercareInstructions(item) {
  if(!item)return [];
  const byReason={
    delivery_delay:["Verificar tracking con proveedor","Informar al cliente desde el sistema existente"],
    wrong_variant:["Comparar SKU/VID facturado con el recibido","Solicitar corrección manual al proveedor"],
    damaged:["Solicitar fotografías y revisar condiciones del proveedor","Preparar reposición o devolución manual"],
    lost:["Consultar estado y reclamación de transporte"],
    return_request:["Comprobar el plazo legal y la política de devolución","Gestionar etiqueta/autorización de retorno manual"],
    refund_request:["Comprobar cobro y obligaciones legales","Tramitar el reembolso únicamente por el canal de pago autorizado"],
    supplier_error:["Investigar el incidente y bloquear nuevas compras de la variante hasta verificar"],
  };
  return {
    steps:byReason[item.reason]||[],
    nextStatuses:NEXT[item.status]||[],
    automaticRefund:false,automaticShipment:false,
    note:"La incidencia no crea un pedido ni ejecuta un reembolso. Cada acción debe verificarse manualmente."
  };
}
