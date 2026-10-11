/**
 * CJ Autopilot operational triage.
 * Decisions use LOCAL order state only. No Stripe/CJ credentials, no supplier
 * writes, and no payment authorization. A real purchase must independently
 * satisfy a fresh live preflight, a durable budget reservation and the
 * merchant's explicit spending mandate.
 */
import {hasVerifiedCjQuote} from "./cjSupplierQueue.js";
import {summarizeCjDailyExposure} from "./cjAutopilotPolicy.js";

const actionableStates = new Set([
  "approval_required","autopilot_ready","payment_required","action_required",
  "mapping_required","cost_required","address_required","manual_purchase_required",
  "cj_creating","cj_creation_unknown","cj_paying","cj_payment_unknown",
]);
const settledStates=new Set(["ordered","shipped","delivered","closed","refunded","returned","cancelled","canceled"]);
const severityOrder={critical:0,warning:1,info:2,complete:3};
const isMoneySafe = record => !record?.externalOrderId && !record?.cjShipmentOrderId &&
  !["cj_creating","cj_creation_unknown","cj_paying","cj_payment_unknown","payment_required"]
   .includes(String(record?.status||""));

export function triageCjAutopilotRecord(record,supplier,order,{
  policy=null,nowMs=Date.now(),
}={}){
  const status=String(record?.status||"").trim().toLowerCase();
  const out={
    fulfillmentId:String(record?.id||""),orderId:String(record?.orderId||""),
    supplierId:String(record?.supplierId||""),status,
    severity:"warning",stage:"review",action:"inspect",
    title:"Revisión del pedido CJ",
    explanation:"Inspecciona los datos y realiza la validación en vivo antes de comprar.",
    nextStep:"Revisar pedido en Administración",
    eligibleForLivePreflight:false,autoPurchaseAuthorized:false,
    safeToRetryCreation:false,safeToRetryPayment:false,
    spendingEnabled:false,financialSideEffect:false,
  };
  if(!record?.id||!record?.orderId){
    return {...out,severity:"critical",stage:"invalid",action:"repair_record",
      title:"Pedido de proveedor incompleto",nextStep:"Revisar la identidad del pedido en la cola"};
  }
  if(["cj_creation_unknown","cj_payment_unknown"].includes(status)){
    return {...out,severity:"critical",stage:"reconciliation",action:"reconcile_remote",
      title:"CJ pudo procesar una operación sin confirmar su resultado",
      explanation:"Nunca crear ni pagar otra vez antes de reconciliar la orden con CJ.",
      nextStep:"Consultar pedidos CJ y conciliar el resultado anterior"};
  }
  if(["cj_creating","cj_paying"].includes(status)){
    const when=Date.parse(String(record?.updatedAt||record?.cjCreatedAt||""));
    const stale=!Number.isFinite(when)||when>nowMs||nowMs-when>=10*60_000;
    return {...out,severity:stale?"critical":"info",stage:stale?"reconciliation":"in_progress",
      action:stale?"reconcile_remote":"wait",
      title:stale?"Operación CJ pendiente demasiado tiempo":"Operación CJ en curso",
      nextStep:stale?"Conciliar con CJ; no reintentar":"Esperar confirmación"};
  }
  if(settledStates.has(status)){
    return {...out,severity:"complete",stage:"processed",action:"track",
      title:"Pedido gestionado",nextStep:"Consultar seguimiento y posventa"};
  }
  if(!supplier||String(supplier.id)!==String(record.supplierId)||
     supplier.active===false||String(supplier.integrationType)!=="cj"){
    return {...out,stage:"supplier",action:"configure_supplier",
      title:"Proveedor CJ no disponible",nextStep:"Revisar la conexión y vinculación del proveedor"};
  }
  if(supplier.cjSandbox!==false){
    return {...out,stage:"supplier",action:"configure_supplier",
      title:"Proveedor CJ en simulación",nextStep:"Revisar el modo del proveedor antes de una compra real"};
  }
  if(!order||String(order.id)!==String(record.orderId)||
    !["paid","confirmed","preparing","processing","ready"].includes(String(order.status))){
    return {...out,stage:"customer_payment",action:"review_customer_payment",
      title:"Pago del cliente no acreditado en la cola",
      nextStep:"Verificar pedido y PaymentIntent directamente en Stripe"};
  }
  if(status==="payment_required"){
    return {...out,stage:"supplier_payment",action:"approve_supplier_payment",
      title:"Pedido CJ creado, pendiente de autorización del pago",
      explanation:"Existe una orden del proveedor. No crear una segunda.",
      nextStep:"Conciliar coste real y aprobar el pago existente si corresponde"};
  }
  const lines=Array.isArray(record.items)?record.items:[];
  const item=lines[0]||{};
  const postal=String(record?.shippingAddress?.postalCode||"").trim();
  const country=String(record?.shippingAddress?.country||"").trim().toLowerCase();
  if(lines.length!==1||Number(item.quantity)!==1||!String(item.supplierVariantId||"").trim()||
     !String(item.supplierSku||"").trim()||
     !["es","españa","spain"].includes(country)||!/^\d{5}$/.test(postal)){
    return {...out,stage:"identity",action:"repair_variant_address",
      title:"Variante, cantidad o dirección incompatible",
      nextStep:"Validar SKU/VID y dirección española completa"};
  }
  if(!hasVerifiedCjQuote(record,{nowMs})){
    return {...out,stage:"freight",action:"refresh_quote",
      title:"Coste o transporte CJ sin verificar recientemente",
      nextStep:"Volver a verificar stock, precio, logística y margen"};
  }
  if(["action_required","mapping_required","cost_required","address_required",
      "manual_purchase_required"].includes(status)){
    return {...out,stage:"exception",action:"inspect",
      title:"CJ requiere intervención",nextStep:"Resolver la incidencia de la cola"};
  }
  if(!["approval_required","autopilot_ready"].includes(status)){
    return {...out,stage:"queue",action:"inspect",
      title:"Pedido fuera de la fase autorizable",nextStep:"Revisar los cambios de estado"};
  }
  if(!policy?.configured||policy.mode!=="simulation"||
     !Array.isArray(policy.allowedSupplierIds)||!policy.allowedSupplierIds.includes(String(supplier.id))){
    return {...out,stage:"policy",action:"configure_budget",
      title:"Falta una política de compra CJ",
      nextStep:"Configurar límite por pedido, presupuesto diario, margen y proveedor"};
  }
  if(!(Number(record.estimatedCost)>0)||Number(record.estimatedCost)>Number(policy.perOrderMaxEur)){
    return {...out,stage:"budget",action:"review_budget",
      title:"El coste supera el límite o es desconocido",
      nextStep:"Revisar coste y presupuesto, sin comprar"};
  }
  if(!isMoneySafe(record)){
    return {...out,severity:"critical",stage:"reconciliation",action:"reconcile_remote",
      title:"La orden ya puede existir en CJ",
      nextStep:"Verificar el pedido CJ antes de otra operación"};
  }
  return {...out,severity:"info",stage:"preflight",action:"run_live_preflight",
    title:"Candidato para comprobación en vivo",
    explanation:"La cola local parece coherente, pero faltan Stripe real, stock y transporte actuales, saldo y autorización.",
    nextStep:"Ejecutar comprobación Stripe + CJ sin comprar",
    eligibleForLivePreflight:true};
}

export function summarizeCjAutopilotOperations({
  records=[],exposureRecords=records,suppliers=[],orders=[],policy=null,nowMs=Date.now(),maxItems=60,
}={}){
  if(!Array.isArray(records)||records.length>3000)throw new Error("Cola CJ demasiado grande para revisión");
  const supplierById=new Map((Array.isArray(suppliers)?suppliers:[]).map(s=>[String(s.id),s]));
  const orderById=new Map((Array.isArray(orders)?orders:[]).filter(Boolean).map(o=>[String(o.id),o]));
  const cjRecords=records.filter(r=>r && (r.provider==="cj"||
    supplierById.get(String(r.supplierId))?.integrationType==="cj"));
  const decisions=cjRecords.map(record=>triageCjAutopilotRecord(
    record,supplierById.get(String(record.supplierId)),orderById.get(String(record.orderId)),
    {policy,nowMs}
  )).sort((a,b)=>(severityOrder[a.severity]??9)-(severityOrder[b.severity]??9)||
    a.orderId.localeCompare(b.orderId));
  const counts={total:decisions.length,critical:0,warning:0,info:0,complete:0,
    reconciliation:0,livePreflightCandidates:0,awaitingSupplierPayment:0};
  for(const row of decisions){
    counts[row.severity]++;
    if(row.stage==="reconciliation")counts.reconciliation++;
    if(row.eligibleForLivePreflight)counts.livePreflightCandidates++;
    if(row.stage==="supplier_payment")counts.awaitingSupplierPayment++;
  }
  const allCjRecords=(Array.isArray(exposureRecords)?exposureRecords:[]).filter(r=>r && (
    r.provider==="cj" || supplierById.get(String(r.supplierId))?.integrationType==="cj"
  ));
  const exposure=summarizeCjDailyExposure(allCjRecords,{date:new Date(nowMs).toISOString()});
  const budget=policy?.configured?{
    perOrderMaxEur:policy.perOrderMaxEur,dailyMaxEur:policy.dailyMaxEur,
    minMarginPercent:policy.minMarginPercent,
    spentOrCommittedEur:exposure.usedEur,
    remainingEur:exposure.verifiedCompletely?
      Math.max(0,Math.round((policy.dailyMaxEur-exposure.usedEur)*100)/100):null,
    exposureVerified:exposure.verifiedCompletely,
    unknownObligations:exposure.unknownCount,
  }:null;
  return {provider:"cj",readOnly:true,automaticPurchasesEnabled:false,
    automaticPaymentsEnabled:false,policyConfigured:Boolean(policy?.configured),
    checkedAt:new Date(nowMs).toISOString(),
    counts,budget,decisions:decisions.slice(0,Math.max(0,Math.min(60,Math.floor(maxItems)))),
    truncated:decisions.length>maxItems,
    message:"Clasificación automática de pedidos, sin mover dinero. Validación en vivo obligatoria antes de aprobar CJ.",
  };
}
