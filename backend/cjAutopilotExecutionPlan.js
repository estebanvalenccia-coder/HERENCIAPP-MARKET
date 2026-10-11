/**
 * Herencia CJ Autopilot: deterministic execution planner (NO live side effects).
 *
 * The runner that eventually spends money must separately verify Stripe,
 * supplier prices, inventory and merchant-approved limits. This planner
 * explicitly refuses to turn a dry-run into a payment authorization.
 */
export const CJ_AUTOPILOT_STAGES=Object.freeze({
  REVIEW:"review_required",
  READY:"ready_for_supervised_creation",
  CREATE_UNKNOWN:"creation_unknown_reconcile",
  PAYMENT_REQUIRED:"payment_requires_authorization",
  PAYMENT_UNKNOWN:"payment_unknown_reconcile",
  TRACKING:"tracking_only",
  STOP:"stop",
});

const finished=new Set(["closed","cancelled","canceled","refunded","returned","disputed"]);
const creationUnknown=new Set(["cj_creating","cj_creation_unknown","supplier_dispatching","supplier_dispatch_unknown"]);
const paymentUnknown=new Set(["cj_paying","cj_payment_unknown"]);
const tracking=new Set(["ordered","shipped","delivered"]);

export function planCjAutopilotAction({record,preflight,policy,merchantAuthorization}={}){
  const status=String(record?.status||"").toLowerCase();
  const result=(stage,reason)=>({
    stage,reason,createSupplierOrder:false,paySupplier:false,
    automaticPurchaseAuthorized:false,actionRequiresAdmin:stage!==CJ_AUTOPILOT_STAGES.TRACKING,
  });
  if(!record?.id || record?.provider!=="cj")
    return result(CJ_AUTOPILOT_STAGES.STOP,"No es un registro CJ autorizado.");
  if(finished.has(status))return result(CJ_AUTOPILOT_STAGES.STOP,"Pedido cerrado o disputado.");
  if(creationUnknown.has(status))return result(CJ_AUTOPILOT_STAGES.CREATE_UNKNOWN,
    "Conciliar creación CJ antes de cualquier reintento.");
  if(paymentUnknown.has(status))return result(CJ_AUTOPILOT_STAGES.PAYMENT_UNKNOWN,
    "Conciliar el pago CJ antes de cualquier reintento.");
  if(tracking.has(status))return result(CJ_AUTOPILOT_STAGES.TRACKING,
    "Solo sincronizar seguimiento, sin más compras.");
  if(status==="payment_required"){
    if(!record.externalOrderId && !record.cjShipmentOrderId)
      return result(CJ_AUTOPILOT_STAGES.PAYMENT_UNKNOWN,
        "No existe ID externo fiable para autorizar un pago.");
    return result(CJ_AUTOPILOT_STAGES.PAYMENT_REQUIRED,
      "Reconciliar precio final y obtener autorización independiente para el pago.");
  }
  if(record.externalOrderId || record.cjShipmentOrderId)
    return result(CJ_AUTOPILOT_STAGES.CREATE_UNKNOWN,
      "Existe un ID de proveedor que debe conciliarse antes de crear otro.");
  if(!["approval_required","autopilot_ready"].includes(status))
    return result(CJ_AUTOPILOT_STAGES.REVIEW,"Pedido no elegible para preparación CJ.");
  if(!policy?.configured || policy.mode!=="simulation" ||
      policy.livePurchasesAllowed!==false || policy.livePaymentsAllowed!==false)
    return result(CJ_AUTOPILOT_STAGES.REVIEW,"Falta política segura en simulación.");
  if(!preflight?.eligibleForSupervisedTest || preflight?.blockers?.length ||
     preflight?.readOnly!==true)
    return result(CJ_AUTOPILOT_STAGES.REVIEW,"Stripe, CJ, margen o presupuesto aún no verificados.");
  if(merchantAuthorization?.livePurchasesAllowed===true ||
     merchantAuthorization?.livePaymentsAllowed===true)
    return result(CJ_AUTOPILOT_STAGES.REVIEW,
      "Una autorización genérica no permite gastos; se exige autorización transaccional.");
  return result(CJ_AUTOPILOT_STAGES.READY,
    "Preparado para prueba supervisada de creación; no crear ni pagar automáticamente.");
}

export function summarizeCjAutopilotPlans(records=[],preflights={},policy){
  const results=(Array.isArray(records)?records:[]).filter(x=>x?.provider==="cj")
    .map(record=>({
      id:String(record.id||""),
      ...planCjAutopilotAction({record,policy,preflight:preflights[record.id]}),
    }));
  const totals={};
  for(const row of results)totals[row.stage]=(totals[row.stage]||0)+1;
  return {results,totals,hasAutomaticPurchases:false,hasAutomaticSupplierPayments:false};
}
